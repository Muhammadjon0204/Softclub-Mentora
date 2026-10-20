using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MentorTaskFlow.Contracts.Auth;
using MentorTaskFlow.Contracts.Telegram;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Identity;
using MentorTaskFlow.IntegrationTests.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.IntegrationTests.Telegram;

/// <summary>
/// A mentor links their account to the CRM by sharing their phone in the bot.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class CrmPhoneLinkTests(PostgresFixture postgres) : IAsyncLifetime
{
    private const string ValidPassword = "Karimov2026Task";
    private const string ChatId = "987654321";
    private const int CrmMentorId = 48;
    private const int TakenCrmMentorId = 53;

    private static readonly DateTimeOffset Seeded = new(2026, 10, 20, 9, 0, 0, TimeSpan.Zero);

    private MentorTaskFlowApiFactory _factory = null!;
    private Guid _mentorId;

    /// <summary>The CRM's mentor list: Hakim at 93-123-45-67, Bahodur already taken by another account.</summary>
    private sealed class FakeCrm : HttpMessageHandler
    {
        private const string Mentors = """
            {"pageNumber":1,"pageSize":100,"totalPages":1,"totalRecords":2,"statusCode":200,"errors":[],"data":[
              {"id":48,"name":"Hakim","surname":"Jumaev","phoneNumber":"931234567","status":{"id":0,"name":"Active"},
               "branch":{"id":1,"name":"Profsouz"},
               "groups":[{"id":392,"name":"C# - 1","branch":{"id":1,"name":"Profsouz"},"status":{"id":1,"name":"Started"},
                          "mentorStatus":{"id":0,"name":"Teaching"},"startDate":"2026-04-15T00:00:00+00:00","endDate":null,"isCurrent":true}]},
              {"id":53,"name":"Bahodur","surname":"Soliev","phoneNumber":"771112233","status":{"id":0,"name":"Active"},
               "branch":{"id":1,"name":"Profsouz"},"groups":[]}
            ]}
            """;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(request.RequestUri!.AbsolutePath.EndsWith("/mentors", StringComparison.Ordinal)
                ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(Mentors, Encoding.UTF8, "application/json") }
                : new HttpResponseMessage(HttpStatusCode.NotFound));
    }

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        await SeedAsync();

        _factory = new MentorTaskFlowApiFactory
        {
            ConnectionStringOverride = postgres.ConnectionString,
            TelegramEnabled = true,
            CrmHandler = new FakeCrm(),
        };
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Sharing_ones_own_phone_links_the_crm_mentor()
    {
        (await PostContactAsync("+992 93 123 45 67")).ShouldContain("Аккаунт связан с CRM");

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        var mentor = await context.Users.SingleAsync(u => u.Id == _mentorId);
        mentor.CrmMentorId.ShouldBe(CrmMentorId);
        mentor.PhoneNumber.ShouldBe("992931234567");

        var audit = await context.AuditLogs.SingleAsync(a => a.Action == AuditActions.CrmMentorLink);
        audit.EntityId.ShouldBe(_mentorId);
        audit.Metadata!.RootElement.GetProperty("source").GetString().ShouldBe("telegram_contact");
    }

    /// <summary>A contact forwarded from the address book is someone else's number: refused.</summary>
    [Fact]
    public async Task Someone_elses_contact_is_refused()
    {
        (await PostContactAsync("+992931234567", contactUserId: 555)).ShouldContain("чужой контакт");

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        (await context.Users.SingleAsync(u => u.Id == _mentorId)).CrmMentorId.ShouldBeNull();
    }

    [Fact]
    public async Task A_number_unknown_to_the_crm_links_nothing()
    {
        (await PostContactAsync("+992900000000")).ShouldContain("нет такого номера");

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        (await context.Users.SingleAsync(u => u.Id == _mentorId)).CrmMentorId.ShouldBeNull();
    }

    /// <summary>Taking over a CRM mentor already linked to another account is the admin's call.</summary>
    [Fact]
    public async Task A_crm_mentor_linked_to_another_account_is_not_taken_over()
    {
        (await PostContactAsync("+992771112233")).ShouldContain("уже связан с другим");

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        (await context.Users.SingleAsync(u => u.Id == _mentorId)).CrmMentorId.ShouldBeNull();
    }

    [Fact]
    public async Task The_crm_command_offers_the_share_button()
    {
        (await PostWebhookAsync(Message(text: "/crm"))).ShouldContain("request_contact");
    }

    /// <summary>Right after binding Telegram, an unlinked mentor is offered the button straight away.</summary>
    [Fact]
    public async Task Binding_telegram_offers_the_crm_link()
    {
        await using (var context = postgres.CreateContext(suppressTenantFilter: true))
        {
            var mentor = await context.Users.SingleAsync(u => u.Id == _mentorId);
            mentor.UnbindTelegram(Seeded);
            await context.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("mentor-head@mentortaskflow.test", ValidPassword));
        login.StatusCode.ShouldBe(HttpStatusCode.OK);
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);

        var issued = await client.PostAsync("/api/v1/telegram/bind-token", null);
        issued.StatusCode.ShouldBe(HttpStatusCode.Created);
        var token = await issued.Content.ReadFromJsonAsync<TelegramBindTokenDto>();

        var reply = await PostWebhookAsync(Message(text: $"/start {token!.Token}"));

        reply.ShouldContain("Готово");
        reply.ShouldContain("request_contact");
    }

    private Task<string> PostContactAsync(string phone, long? contactUserId = null) =>
        PostWebhookAsync(Message(contact: new { phone_number = phone, first_name = "Hakim", user_id = contactUserId ?? long.Parse(ChatId) }));

    private static JsonElement Message(string? text = null, object? contact = null) =>
        JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(new
        {
            update_id = 1,
            message = new
            {
                message_id = 1,
                chat = new { id = long.Parse(ChatId), type = "private" },
                from = new { id = long.Parse(ChatId), first_name = "Hakim" },
                text,
                contact,
            },
        }));

    private async Task<string> PostWebhookAsync(JsonElement update)
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Telegram-Bot-Api-Secret-Token", MentorTaskFlowApiFactory.TelegramWebhookSecret);

        var response = await client.PostAsJsonAsync("/api/v1/telegram/webhook", update);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        return await response.Content.ReadAsStringAsync();
    }

    private async Task SeedAsync()
    {
        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        var passwordHash = new Pbkdf2PasswordHasher().Hash(ValidPassword);

        var organization = Organization.Provision("SoftClub Academy", "softclub-academy", Seeded);
        context.Organizations.Add(organization);

        var headOffice = Branch.CreateHeadOffice(organization.Id, "Главный офис", "HQ", null, "Asia/Dushanbe", Seeded);
        context.Branches.Add(headOffice);

        var sharp = Category.Create(organization.Id, headOffice.Id, "C#", null, Seeded);
        context.Categories.Add(sharp);
        context.CategorySettings.Add(CategorySettings.CreateDefault(sharp, headOffice.TimeZoneId, Seeded));

        var mentor = User.CreateMentor(organization.Id, headOffice.Id, sharp.Id, "Хаким Джумаев", "mentor-head@mentortaskflow.test", Seeded);
        mentor.SetPasswordHash(passwordHash, Seeded);
        mentor.BindTelegram(ChatId, Seeded);

        var other = User.CreateMentor(organization.Id, headOffice.Id, sharp.Id, "Баходур Солиев", "other@mentortaskflow.test", Seeded);
        other.LinkCrmMentor(TakenCrmMentorId, Seeded);

        context.Users.AddRange(mentor, other);
        await context.SaveChangesAsync();

        _mentorId = mentor.Id;
    }
}
