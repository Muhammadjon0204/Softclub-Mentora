using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Auth;
using MentorTaskFlow.Contracts.Integrations;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Reports;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Identity;
using MentorTaskFlow.IntegrationTests.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.IntegrationTests.Integrations;

/// <summary>
/// A mentor's weekly report on a CRM group: made from the period's figures, drafted by the AI without
/// names, one per period, private until sent, then read by the Lead.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class CrmReportTests(PostgresFixture postgres) : IAsyncLifetime
{
    private const string Password = "Karimov2026Task";
    private const int GroupId = 500;
    private const int ClosedWeek = 1;
    private const int OpenWeek = 2;

    private static readonly DateTimeOffset Seeded = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private readonly StubAi _ai = new();
    private MentorTaskFlowApiFactory _factory = null!;

    /// <summary>
    /// React - 1, taught by CRM mentors 7 and 8. Week 1 is over: Ali scored 100, Salom missed every
    /// day and got a remark with his name in it. Week 2 is still going.
    /// </summary>
    private sealed class FakeCrm : HttpMessageHandler
    {
        private const string Group = """
            {"statusCode":200,"errors":[],"data":{"id":500,"name":"React - 1","course":{"id":4,"name":"React"},"branch":{"id":1,"name":"Profsouz"},
             "status":{"id":1,"name":"Started"},"examInterval":{"id":1,"name":"Weekly"},"startsAt":"2026-09-30T19:00:00+00:00","finishedAt":"2099-01-01T19:00:00+00:00",
             "durationMonths":4,"requiredStudents":10,"enrolledStudents":2,"timeTables":[],
             "mentors":[{"id":7,"fullName":"Mirzoev Muhammadjon","startedAt":"2026-09-30T19:00:00+00:00","endedAt":null,"status":{"id":0,"name":"Teaching"}},
                        {"id":8,"fullName":"Soliev Bahodur","startedAt":"2026-09-30T19:00:00+00:00","endedAt":null,"status":{"id":2,"name":"Support"}}],
             "students":[{"id":1,"firstName":"Ali","lastName":"Zamirov","status":{"id":0,"name":"Active"},"note":null,"joinedAt":"2026-09-30T10:00:00+00:00","leftAt":null},
                         {"id":2,"firstName":"Salom","lastName":"Salomov","status":{"id":0,"name":"Active"},"note":null,"joinedAt":"2026-09-30T10:00:00+00:00","leftAt":null}]}}
            """;

        private static string Mark(int day, bool attended, int grade, string notes = "[]") =>
            $$"""{"id":{{day}},"date":"2026-10-{{day:00}}T00:00:00+00:00","status":{"id":0,"name":"Active"},"isAttended":{{attended.ToString().ToLowerInvariant()}},"lateMinutes":0,"grade":{{grade}},"bonus":0,"notes":{{notes}}}""";

        private static string Journal()
        {
            var days = string.Join(",", Enumerable.Range(5, 6).Select(d => $$"""{"date":"2026-10-{{d:00}}T00:00:00+00:00","isExam":{{(d == 10).ToString().ToLowerInvariant()}},"isDayOff":false}"""));
            var ali = string.Join(",", Enumerable.Range(5, 6).Select(d => Mark(d, true, d == 10 ? 70 : 5)));
            var remark = """[{"id":1,"type":{"id":4,"name":"BadBehavior"},"content":"Salomov мешал на уроке, позвонить маме","authorName":"Mirzoev","createdAt":"2026-10-06T10:00:00+00:00"}]""";
            var salom = string.Join(",", Enumerable.Range(5, 6).Select(d => Mark(d, false, 0, d == 6 ? remark : "[]")));
            return $$"""
                {"statusCode":200,"errors":[],"data":[
                  {"week":2,"label":"2","isComplete":false,"examMax":70,"days":[{"date":"2099-01-05T00:00:00+00:00","isExam":false,"isDayOff":false}],"students":[]},
                  {"week":1,"label":"1","isComplete":true,"examMax":70,"days":[{{days}}],
                   "students":[{"id":1,"fullName":"Ali Zamirov","marks":[{{ali}}]},{"id":2,"fullName":"Salom Salomov","marks":[{{salom}}]}]}
                ]}
                """;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath;
            var body = path.EndsWith($"/groups/{GroupId}/journal", StringComparison.Ordinal) ? Journal()
                : path.EndsWith($"/groups/{GroupId}", StringComparison.Ordinal) ? Group
                : """{"statusCode":404,"errors":["Группа не найдена."],"data":null}""";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }

    private sealed class StubAi : IAiSummaryProvider
    {
        public AiSummaryPrompt? LastPrompt { get; private set; }

        public string ModelId => "gemini-test";

        public string PromptVersion => "v1.0";

        public bool IsConfigured => true;

        public Task<AiSummaryCompletion> GenerateAsync(AiSummaryPrompt prompt, CancellationToken cancellationToken)
        {
            LastPrompt = prompt;
            return Task.FromResult(new AiSummaryCompletion(
                "**Общая картина** Студент 1 набрал 100. **Зона риска** Студент 2 пропустил всю неделю.", 100, 50, "req-1"));
        }
    }

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        await SeedAsync();

        _factory = new MentorTaskFlowApiFactory
        {
            ConnectionStringOverride = postgres.ConnectionString,
            CrmHandler = new FakeCrm(),
            AiEnabled = true,
            AiProvider = _ai,
        };
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task The_mentor_makes_the_report_and_the_ai_never_sees_a_name()
    {
        using var mentor = await SignInAsync("mentor-a@mentortaskflow.test");

        var created = await mentor.PostAsync(ReportUrl(ClosedWeek), null);
        created.StatusCode.ShouldBe(HttpStatusCode.Created);
        var state = await ReadAsync<CrmReportStateDto>(created);

        state.Report.ShouldNotBeNull();
        state.Report.Status.ShouldBe("Draft");
        state.Report.CanEdit.ShouldBeTrue();
        state.Report.Period.Students.Count.ShouldBe(2);

        // The labels come back as names in the mentor's draft...
        state.Report.Conclusions.ShouldContain("Ali Zamirov набрал 100");
        state.Report.Conclusions.ShouldContain("Salom Salomov пропустил");

        // ...and no name, in the figures or in the remark, ever reached the AI.
        var sent = _ai.LastPrompt!.Data;
        sent.ShouldNotContain("Ali");
        sent.ShouldNotContain("Salom");
        sent.ShouldContain("Студент 2 мешал на уроке");

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        (await context.AuditLogs.CountAsync(a => a.Action == AuditActions.CrmReportCreate)).ShouldBe(1);
    }

    /// <summary>Two mentors, one report: the second sees who writes it, never the draft itself.</summary>
    [Fact]
    public async Task A_second_mentor_of_the_group_sees_who_is_writing_it()
    {
        using var first = await SignInAsync("mentor-a@mentortaskflow.test");
        (await first.PostAsync(ReportUrl(ClosedWeek), null)).StatusCode.ShouldBe(HttpStatusCode.Created);

        using var second = await SignInAsync("mentor-b@mentortaskflow.test");
        var state = await ReadAsync<CrmReportStateDto>(await second.GetAsync(ReportUrl(ClosedWeek)));

        state.Report.ShouldBeNull();
        state.CanCreate.ShouldBeFalse();
        state.Blocked!.ShouldContain("Ментор А");

        (await second.PostAsync(ReportUrl(ClosedWeek), null)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task A_week_still_going_cannot_be_reported()
    {
        using var mentor = await SignInAsync("mentor-a@mentortaskflow.test");

        var state = await ReadAsync<CrmReportStateDto>(await mentor.GetAsync(ReportUrl(OpenWeek)));
        state.CanCreate.ShouldBeFalse();
        state.CannotCreate!.ShouldContain("Неделя ещё идёт");

        (await mentor.PostAsync(ReportUrl(OpenWeek), null)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    /// <summary>A mentor who never taught the group does not see it — nor its reports.</summary>
    [Fact]
    public async Task A_mentor_who_does_not_teach_the_group_sees_nothing()
    {
        using var stranger = await SignInAsync("mentor-c@mentortaskflow.test");

        (await stranger.GetAsync(ReportUrl(ClosedWeek))).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.PostAsync(ReportUrl(ClosedWeek), null)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    /// <summary>The draft is the mentor's; once sent, the Lead reads it and nobody edits it.</summary>
    [Fact]
    public async Task The_lead_reads_the_report_once_it_is_sent()
    {
        using var mentor = await SignInAsync("mentor-a@mentortaskflow.test");
        using var lead = await SignInAsync("lead@mentortaskflow.test");

        await mentor.PostAsync(ReportUrl(ClosedWeek), null);
        (await mentor.PutAsJsonAsync(ReportUrl(ClosedWeek), new CrmReportConclusionsRequest("Мои выводы по неделе.")))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        (await ReadAsync<CrmReportListDto>(await lead.GetAsync("/api/v1/integrations/crm/reports"))).Reports.ShouldBeEmpty();

        (await mentor.PostAsync($"{ReportUrl(ClosedWeek)}/send", null)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var list = await ReadAsync<CrmReportListDto>(await lead.GetAsync("/api/v1/integrations/crm/reports"));
        var row = list.Reports.ShouldHaveSingleItem();
        row.Status.ShouldBe("Sent");
        row.AuthorName.ShouldBe("Ментор А");

        var report = await ReadAsync<CrmGroupReportDto>(await lead.GetAsync($"/api/v1/integrations/crm/reports/{row.Id}"));
        report.Conclusions.ShouldBe("Мои выводы по неделе.");
        report.CanEdit.ShouldBeFalse();

        (await mentor.PutAsJsonAsync(ReportUrl(ClosedWeek), new CrmReportConclusionsRequest("Поменял после отправки")))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        (await context.CrmGroupReports.SingleAsync()).Status.ShouldBe(CrmGroupReportStatus.Sent);

        // The Lead is told — by email (and Telegram once bound) — with the figures and a link to the report.
        var stored = await context.CrmGroupReports.SingleAsync();
        var leadUser = await context.Users.SingleAsync(u => u.Email == "lead@mentortaskflow.test");
        var notices = await context.NotificationOutbox.Where(n => n.EventType == NotificationEventTypes.CrmReportSent).ToListAsync();
        var notice = notices.ShouldHaveSingleItem();
        notice.UserId.ShouldBe(leadUser.Id);
        var body = notice.Payload.RootElement;
        body.GetProperty("mentorFullName").GetString().ShouldBe("Ментор А");
        body.GetProperty("actionPath").GetString().ShouldBe($"/lead/crm?report={stored.Id:D}");
        body.GetProperty("summaryLines").EnumerateArray().Select(x => x.GetString()).ShouldContain(l => l!.StartsWith("Средний балл группы:"));
    }

    private static string ReportUrl(int week) => $"/api/v1/integrations/crm/groups/{GroupId}/weeks/{week}/report";

    private async Task<HttpClient> SignInAsync(string email)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await ReadAsync<LoginResponse>(response)).AccessToken);
        return client;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<T>(await response.Content.ReadAsStringAsync(), Web)!;

    private async Task SeedAsync()
    {
        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        var hash = new Pbkdf2PasswordHasher().Hash(Password);

        var organization = Organization.Provision("SoftClub Academy", "softclub-academy", Seeded);
        context.Organizations.Add(organization);

        var branch = Branch.CreateHeadOffice(organization.Id, "Главный офис", "HQ", null, "Asia/Dushanbe", Seeded);
        context.Branches.Add(branch);

        var react = Category.Create(organization.Id, branch.Id, "React", null, Seeded);
        context.Categories.Add(react);
        context.CategorySettings.Add(CategorySettings.CreateDefault(react, branch.TimeZoneId, Seeded));

        var lead = User.CreateLead(organization.Id, branch.Id, react.Id, "Лид React", "lead@mentortaskflow.test", Seeded);
        var a = User.CreateMentor(organization.Id, branch.Id, react.Id, "Ментор А", "mentor-a@mentortaskflow.test", Seeded);
        var b = User.CreateMentor(organization.Id, branch.Id, react.Id, "Ментор Б", "mentor-b@mentortaskflow.test", Seeded);
        var c = User.CreateMentor(organization.Id, branch.Id, react.Id, "Ментор В", "mentor-c@mentortaskflow.test", Seeded);
        a.LinkCrmMentor(7, Seeded);
        b.LinkCrmMentor(8, Seeded);
        c.LinkCrmMentor(9, Seeded);

        foreach (var user in new[] { lead, a, b, c })
        {
            user.SetPasswordHash(hash, Seeded);
        }

        context.Users.AddRange(lead, a, b, c);
        await context.SaveChangesAsync();
    }
}
