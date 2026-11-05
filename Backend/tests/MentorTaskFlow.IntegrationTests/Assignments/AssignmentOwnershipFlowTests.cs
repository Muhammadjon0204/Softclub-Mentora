using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MentorTaskFlow.Contracts.Access;
using MentorTaskFlow.Contracts.Assignments;
using MentorTaskFlow.Contracts.Auth;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Proposals;
using MentorTaskFlow.Contracts.Reviews;
using MentorTaskFlow.Contracts.Submissions;
using MentorTaskFlow.Domain.Access;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Proposals;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Identity;
using MentorTaskFlow.IntegrationTests.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.IntegrationTests.Assignments;

/// <summary>
/// Work handed out by administrators, moved deadlines, proposals and permissions, end to end.
/// </summary>
/// <remarks>
/// Against a real database on purpose: the scope triggers are the part that decides whether an
/// administrator can hand work out at all, and no unit test reaches them.
/// </remarks>
[Collection(PostgresCollection.Name)]
public sealed class AssignmentOwnershipFlowTests(PostgresFixture postgres, MinioFixture minio) : IAsyncLifetime
{
    private const string ValidPassword = "Karimov2026Task";
    private const string OrganizationAdmin = "organization-admin@mentortaskflow.test";
    private const string BranchAdmin = "branch-admin-head@mentortaskflow.test";
    private const string Lead = "lead-head@mentortaskflow.test";
    private const string Mentor = "mentor-head@mentortaskflow.test";
    private const string Reason = "Лид в отпуске до среды";

    private static readonly DateTimeOffset Seeded = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset InAWeek = DateTimeOffset.UtcNow.AddDays(7);

    private MentorTaskFlowApiFactory _factory = null!;
    private Guid _branchAdminId;
    private Guid _leadId;
    private Guid _mentorId;
    private Guid _secondMentorId;
    private Guid _khujandMentorId;

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        await minio.ResetAsync();
        await SeedAsync();

        _factory = new MentorTaskFlowApiFactory
        {
            ConnectionStringOverride = postgres.ConnectionString,
            StorageEndpointOverride = minio.Endpoint,
        };
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    // -----------------------------------------------------------------
    // Who hands work out
    // -----------------------------------------------------------------

    [Theory]
    [InlineData(BranchAdmin)]
    [InlineData(OrganizationAdmin)]
    public async Task An_administrator_hands_work_to_a_mentor(string email)
    {
        using var admin = await SignInAsync(email);

        var published = await PublishedAsync(admin, _mentorId);

        published.Status.ShouldBe(nameof(AssignmentStatus.Assigned));
        published.AssignedByRole.ShouldBe(nameof(UserRole.Admin));
        published.CanManage.ShouldBeTrue();
    }

    [Fact]
    public async Task An_administrator_hands_work_to_a_lead_and_the_lead_sees_it_as_their_own()
    {
        using var admin = await SignInAsync(BranchAdmin);
        var published = await PublishedAsync(admin, _leadId);

        using var lead = await SignInAsync(Lead);
        var seen = await ReadAsync<AssignmentDto>(await lead.GetAsync($"/api/v1/assignments/{published.Id}"));

        seen.AssignedToId.ShouldBe(_leadId);
        seen.CanManage.ShouldBeFalse();
    }

    [Fact]
    public async Task A_lead_still_hands_work_only_to_mentors()
    {
        using var lead = await SignInAsync(Lead);

        var response = await lead.PostAsJsonAsync("/api/v1/assignments/drafts",
            new CreateAssignmentDraftRequest(_leadId, null, "Самому себе", null, InAWeek));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.CrossScopeReference);
    }

    [Fact]
    public async Task A_branch_admin_cannot_reach_past_their_branch()
    {
        using var admin = await SignInAsync(BranchAdmin);

        var response = await admin.PostAsJsonAsync("/api/v1/assignments/drafts",
            new CreateAssignmentDraftRequest(_khujandMentorId, null, "Чужой филиал", null, InAWeek));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.CrossScopeReference);
    }

    [Fact]
    public async Task An_organization_admin_reaches_every_branch()
    {
        using var owner = await SignInAsync(OrganizationAdmin);

        (await PublishedAsync(owner, _khujandMentorId)).Status.ShouldBe(nameof(AssignmentStatus.Assigned));
    }

    // -----------------------------------------------------------------
    // Who reviews: whoever handed the work out
    // -----------------------------------------------------------------

    [Fact]
    public async Task The_administrator_who_gave_the_work_reviews_it()
    {
        using var admin = await SignInAsync(BranchAdmin);
        var work = await SubmittedAsync(admin, _mentorId, Mentor);

        (await StartReviewAsync(admin, work.Id)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var response = await DecideAsync(admin, work.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task The_lead_cannot_review_what_an_administrator_gave()
    {
        using var admin = await SignInAsync(BranchAdmin);
        var work = await SubmittedAsync(admin, _mentorId, Mentor);

        using var lead = await SignInAsync(Lead);
        var response = await StartReviewAsync(lead, work.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.AssignmentNotOwner);
    }

    [Theory]
    [InlineData(BranchAdmin)]
    [InlineData(OrganizationAdmin)]
    public async Task An_administrator_cannot_review_what_a_lead_gave(string email)
    {
        using var lead = await SignInAsync(Lead);
        var work = await SubmittedAsync(lead, _mentorId, Mentor);
        await StartReviewAsync(lead, work.Id);

        using var admin = await SignInAsync(email);
        var fresh = await ReadAsync<AssignmentDto>(await admin.GetAsync($"/api/v1/assignments/{work.Id}"));
        fresh.CanManage.ShouldBeFalse();

        var response = await DecideAsync(admin, work.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.AssignmentNotOwner);
    }

    [Fact]
    public async Task The_owner_of_the_organization_cannot_review_what_a_branch_admin_gave()
    {
        using var admin = await SignInAsync(BranchAdmin);
        var work = await SubmittedAsync(admin, _mentorId, Mentor);

        using var owner = await SignInAsync(OrganizationAdmin);
        var response = await StartReviewAsync(owner, work.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_lead_hands_in_work_and_the_administrator_who_gave_it_decides()
    {
        using var admin = await SignInAsync(BranchAdmin);
        var work = await SubmittedAsync(admin, _leadId, Lead);

        await StartReviewAsync(admin, work.Id);
        (await DecideAsync(admin, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);

        var approved = await ReadAsync<AssignmentDto>(await admin.GetAsync($"/api/v1/assignments/{work.Id}"));
        approved.Status.ShouldBe(nameof(AssignmentStatus.Approved));
    }

    [Fact]
    public async Task A_lead_never_reviews_their_own_work()
    {
        using var admin = await SignInAsync(BranchAdmin);
        var work = await SubmittedAsync(admin, _leadId, Lead);

        using var lead = await SignInAsync(Lead);

        (await StartReviewAsync(lead, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    // -----------------------------------------------------------------
    // Moving the deadline
    // -----------------------------------------------------------------

    [Fact]
    public async Task The_owner_moves_the_deadline_and_the_history_says_why()
    {
        using var lead = await SignInAsync(Lead);
        var work = await PublishedAsync(lead, _mentorId);
        var newDue = InAWeek.AddDays(3);

        var moved = await ReadAsync<AssignmentDto>(await lead.PostAsJsonAsync(
            $"/api/v1/assignments/{work.Id}/reschedule",
            new RescheduleAssignmentRequest(newDue, Reason, work.ConcurrencyToken)));

        moved.CurrentDueAt.ShouldBe(newDue, TimeSpan.FromMilliseconds(1));
        moved.InitialDueAt.ShouldBe(work.InitialDueAt);

        var history = await ReadAsync<List<TaskEventDto>>(await lead.GetAsync($"/api/v1/assignments/{work.Id}/history"));
        var entry = history.Single(e => e.EventType == nameof(TaskEventType.DeadlineChanged));

        entry.Reason.ShouldBe(Reason);
        entry.NewDueAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task A_deadline_can_be_brought_forward_past_the_original()
    {
        using var lead = await SignInAsync(Lead);
        var work = await PublishedAsync(lead, _mentorId);

        var response = await lead.PostAsJsonAsync($"/api/v1/assignments/{work.Id}/reschedule",
            new RescheduleAssignmentRequest(InAWeek.AddDays(-3), Reason, work.ConcurrencyToken));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Nobody_else_moves_the_deadline()
    {
        using var lead = await SignInAsync(Lead);
        var work = await PublishedAsync(lead, _mentorId);

        using var admin = await SignInAsync(BranchAdmin);

        var response = await admin.PostAsJsonAsync($"/api/v1/assignments/{work.Id}/reschedule",
            new RescheduleAssignmentRequest(InAWeek.AddDays(1), Reason, work.ConcurrencyToken));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.AssignmentNotOwner);
    }

    [Fact]
    public async Task Work_that_was_handed_in_keeps_its_deadline()
    {
        using var lead = await SignInAsync(Lead);
        var work = await SubmittedAsync(lead, _mentorId, Mentor);
        var fresh = await ReadAsync<AssignmentDto>(await lead.GetAsync($"/api/v1/assignments/{work.Id}"));

        var response = await lead.PostAsJsonAsync($"/api/v1/assignments/{work.Id}/reschedule",
            new RescheduleAssignmentRequest(InAWeek.AddDays(1), Reason, fresh.ConcurrencyToken));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.DeadlineChangeNotAllowed);
    }

    [Fact]
    public async Task Moving_a_deadline_shows_in_the_audit_log_for_the_superior()
    {
        using var lead = await SignInAsync(Lead);
        var work = await PublishedAsync(lead, _mentorId);

        await lead.PostAsJsonAsync($"/api/v1/assignments/{work.Id}/reschedule",
            new RescheduleAssignmentRequest(InAWeek.AddDays(1), Reason, work.ConcurrencyToken));

        await using var context = postgres.CreateContext(suppressTenantFilter: true);

        (await context.AuditLogs.CountAsync(a => a.Action == Domain.Auditing.AuditActions.AssignmentDeadlineChange)).ShouldBe(1);
    }

    // -----------------------------------------------------------------
    // Proposals
    // -----------------------------------------------------------------

    [Fact]
    public async Task An_approved_proposal_becomes_the_authors_assignment()
    {
        using var mentor = await SignInAsync(Mentor);
        var proposal = await ProposeAsync(mentor);

        using var lead = await SignInAsync(Lead);
        var approved = await ReadAsync<ProposalDto>(await lead.PostAsJsonAsync(
            $"/api/v1/proposals/{proposal.Id}/approve",
            new ApproveProposalRequest(InAWeek, null, null, null, proposal.ConcurrencyToken)));

        approved.Status.ShouldBe(nameof(ProposalStatus.Approved));
        approved.AssignmentId.ShouldNotBeNull();

        var assignment = await ReadAsync<AssignmentDto>(await mentor.GetAsync($"/api/v1/assignments/{approved.AssignmentId}"));

        assignment.Status.ShouldBe(nameof(AssignmentStatus.Assigned));
        assignment.Source.ShouldBe(nameof(AssignmentSource.Proposal));
        assignment.AssignedToId.ShouldBe(_mentorId);
        assignment.Title.ShouldBe("Мастер-класс по Git");
    }

    [Fact]
    public async Task A_rejection_tells_the_author_why_and_creates_nothing()
    {
        using var mentor = await SignInAsync(Mentor);
        var proposal = await ProposeAsync(mentor);

        using var lead = await SignInAsync(Lead);
        await lead.PostAsJsonAsync($"/api/v1/proposals/{proposal.Id}/reject",
            new RejectProposalRequest("В этом месяце нет свободной аудитории", proposal.ConcurrencyToken));

        var seen = await ReadAsync<ProposalDto>(await mentor.GetAsync($"/api/v1/proposals/{proposal.Id}"));

        seen.Status.ShouldBe(nameof(ProposalStatus.Rejected));
        seen.DecisionComment.ShouldBe("В этом месяце нет свободной аудитории");
        seen.AssignmentId.ShouldBeNull();
    }

    [Fact]
    public async Task While_the_category_has_a_lead_an_administrator_only_watches_proposals()
    {
        using var mentor = await SignInAsync(Mentor);
        var proposal = await ProposeAsync(mentor);

        using var admin = await SignInAsync(BranchAdmin);
        var seen = await ReadAsync<ProposalDto>(await admin.GetAsync($"/api/v1/proposals/{proposal.Id}"));
        seen.CanDecide.ShouldBeFalse();

        var response = await admin.PostAsJsonAsync($"/api/v1/proposals/{proposal.Id}/approve",
            new ApproveProposalRequest(InAWeek, null, null, null, proposal.ConcurrencyToken));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_mentor_does_not_see_what_a_colleague_proposed()
    {
        using var mentor = await SignInAsync(Mentor);
        var proposal = await ProposeAsync(mentor);

        using var colleague = await SignInAsync("mentor2-head@mentortaskflow.test");

        (await colleague.GetAsync($"/api/v1/proposals/{proposal.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task A_decided_proposal_cannot_be_decided_twice()
    {
        using var mentor = await SignInAsync(Mentor);
        var proposal = await ProposeAsync(mentor);

        using var lead = await SignInAsync(Lead);
        var approved = await ReadAsync<ProposalDto>(await lead.PostAsJsonAsync(
            $"/api/v1/proposals/{proposal.Id}/approve",
            new ApproveProposalRequest(InAWeek, null, null, null, proposal.ConcurrencyToken)));

        var again = await lead.PostAsJsonAsync($"/api/v1/proposals/{proposal.Id}/reject",
            new RejectProposalRequest("Передумал совсем", approved.ConcurrencyToken));

        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(again)).ShouldBe(ErrorCodes.ProposalNotPending);
    }

    // -----------------------------------------------------------------
    // Permissions
    // -----------------------------------------------------------------

    [Fact]
    public async Task A_role_rule_takes_effect_on_the_next_request()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        using var lead = await SignInAsync(Lead);

        await SetRoleRuleAsync(owner, PermissionSubject.Lead, Permissions.AssignmentsAssign, false);

        var response = await lead.PostAsJsonAsync("/api/v1/assignments/drafts",
            new CreateAssignmentDraftRequest(_mentorId, null, "Задача", null, InAWeek));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.PermissionDenied);
    }

    [Fact]
    public async Task A_personal_exception_beats_the_role_rule()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        using var lead = await SignInAsync(Lead);

        await SetRoleRuleAsync(owner, PermissionSubject.Lead, Permissions.AssignmentsAssign, false);

        var set = await owner.PutAsJsonAsync($"/api/v1/permissions/users/{_leadId}",
            new SetUserPermissionsRequest([new UserPermissionChange(Permissions.AssignmentsAssign, true)]));
        set.StatusCode.ShouldBe(HttpStatusCode.OK);

        var response = await lead.PostAsJsonAsync("/api/v1/assignments/drafts",
            new CreateAssignmentDraftRequest(_mentorId, null, "Задача", null, InAWeek));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task The_profile_lists_only_what_the_person_may_do()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        using var mentor = await SignInAsync(Mentor);

        await SetRoleRuleAsync(owner, PermissionSubject.Mentor, Permissions.ProposalsCreate, false);

        var me = await ReadAsync<AuthUserDto>(await mentor.GetAsync("/api/v1/auth/me"));

        me.Permissions.ShouldNotBeNull();
        me.Permissions.ShouldNotContain(Permissions.ProposalsCreate);
        me.Permissions.ShouldContain(Permissions.ReportsView);
    }

    [Fact]
    public async Task An_organization_admin_cannot_be_restricted()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        var ownerId = await IdOfAsync(OrganizationAdmin);

        var set = await owner.PutAsJsonAsync($"/api/v1/permissions/users/{ownerId}",
            new SetUserPermissionsRequest([new UserPermissionChange(Permissions.AuditView, false)]));

        set.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_branch_admin_restricts_their_people_but_not_themselves_or_a_role()
    {
        using var admin = await SignInAsync(BranchAdmin);

        var ownPeople = await admin.PutAsJsonAsync($"/api/v1/permissions/users/{_mentorId}",
            new SetUserPermissionsRequest([new UserPermissionChange(Permissions.ProposalsCreate, false)]));
        ownPeople.StatusCode.ShouldBe(HttpStatusCode.OK);

        var self = await admin.PutAsJsonAsync($"/api/v1/permissions/users/{_branchAdminId}",
            new SetUserPermissionsRequest([new UserPermissionChange(Permissions.AuditView, true)]));
        self.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var role = await admin.PutAsJsonAsync("/api/v1/permissions/roles",
            new SetRolePermissionRequest(nameof(PermissionSubject.Mentor), Permissions.ProposalsCreate, false));
        role.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var otherBranch = await admin.PutAsJsonAsync($"/api/v1/permissions/users/{_khujandMentorId}",
            new SetUserPermissionsRequest([new UserPermissionChange(Permissions.ProposalsCreate, false)]));
        otherBranch.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Clearing_a_rule_returns_the_role_to_the_default()
    {
        using var owner = await SignInAsync(OrganizationAdmin);

        await SetRoleRuleAsync(owner, PermissionSubject.Lead, Permissions.ReportsView, false);
        await SetRoleRuleAsync(owner, PermissionSubject.Lead, Permissions.ReportsView, null);

        var matrix = await ReadAsync<List<RolePermissionRowDto>>(await owner.GetAsync("/api/v1/permissions/roles"));
        var cell = matrix.Single(r => r.Key == Permissions.ReportsView).Cells.Single(c => c.Subject == nameof(PermissionSubject.Lead));

        cell.Rule.ShouldBeNull();
        cell.Effective.ShouldBeTrue();
    }

    [Fact]
    public async Task A_permission_cannot_be_given_to_a_role_it_does_not_apply_to()
    {
        using var owner = await SignInAsync(OrganizationAdmin);

        var response = await owner.PutAsJsonAsync("/api/v1/permissions/roles",
            new SetRolePermissionRequest(nameof(PermissionSubject.Mentor), Permissions.AuditView, true));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private static async Task SetRoleRuleAsync(HttpClient owner, PermissionSubject subject, string permission, bool? allowed)
    {
        var response = await owner.PutAsJsonAsync("/api/v1/permissions/roles",
            new SetRolePermissionRequest(subject.ToString(), permission, allowed));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static async Task<AssignmentDto> PublishedAsync(HttpClient client, Guid assigneeId)
    {
        var created = await client.PostAsJsonAsync("/api/v1/assignments/drafts",
            new CreateAssignmentDraftRequest(assigneeId, null, "Подготовить отчёт", null, InAWeek));
        created.StatusCode.ShouldBe(HttpStatusCode.Created);

        var draft = await ReadAsync<AssignmentDto>(created);

        return await ReadAsync<AssignmentDto>(await client.PostAsJsonAsync(
            $"/api/v1/assignments/{draft.Id}/publish",
            new AssignmentActionRequest(draft.ConcurrencyToken)));
    }

    private async Task<AssignmentDto> SubmittedAsync(HttpClient giver, Guid assigneeId, string executorEmail)
    {
        var published = await PublishedAsync(giver, assigneeId);

        using var executor = await SignInAsync(executorEmail);
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Pdf());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "работа.pdf");

        var uploaded = await executor.PostAsync($"/api/v1/assignments/{published.Id}/submissions", form);
        uploaded.StatusCode.ShouldBe(HttpStatusCode.Created);

        return published;
    }

    private static async Task<HttpResponseMessage> StartReviewAsync(HttpClient client, Guid assignmentId)
    {
        var fresh = await ReadAsync<AssignmentDto>(await client.GetAsync($"/api/v1/assignments/{assignmentId}"));

        return await client.PostAsJsonAsync(
            $"/api/v1/assignments/{assignmentId}/start-review",
            new AssignmentActionRequest(fresh.ConcurrencyToken));
    }

    private static async Task<HttpResponseMessage> DecideAsync(HttpClient client, Guid assignmentId)
    {
        var fresh = await ReadAsync<AssignmentDto>(await client.GetAsync($"/api/v1/assignments/{assignmentId}"));
        var versions = await ReadAsync<List<SubmissionDto>>(await client.GetAsync($"/api/v1/assignments/{assignmentId}/submissions"));

        return await client.PostAsJsonAsync(
            $"/api/v1/submissions/{versions[^1].Id}/reviews",
            new CreateReviewRequest("Approved", fresh.ConcurrencyToken));
    }

    private static async Task<ProposalDto> ProposeAsync(HttpClient mentor)
    {
        var response = await mentor.PostAsJsonAsync("/api/v1/proposals",
            new CreateProposalRequest("MasterClass", "Мастер-класс по Git", "Покажу ветки, rebase и разбор конфликтов.", InAWeek));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        return await ReadAsync<ProposalDto>(response);
    }

    private static byte[] Pdf() => Encoding.UTF8.GetBytes("%PDF-1.7\nсодержимое работы\ntrailer\n%%EOF\n");

    private async Task<Guid> IdOfAsync(string email)
    {
        await using var context = postgres.CreateContext(suppressTenantFilter: true);

        return await context.Users.Where(u => u.Email == email).Select(u => u.Id).FirstAsync();
    }

    private async Task<HttpClient> SignInAsync(string email)
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, ValidPassword));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        client.DefaultRequestHeaders.Authorization =
            new("Bearer", (await ReadAsync<LoginResponse>(response)).AccessToken);

        return client;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<T>(
            await response.Content.ReadAsStringAsync(),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

    private static async Task<string?> ReadCodeAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("code").GetString();
    }

    private async Task SeedAsync()
    {
        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        var passwordHash = new Pbkdf2PasswordHasher().Hash(ValidPassword);

        var organization = Organization.Provision("SoftClub Academy", "softclub-academy", Seeded);
        context.Organizations.Add(organization);

        var headOffice = Branch.CreateHeadOffice(organization.Id, "Главный офис", "HQ", null, "Asia/Dushanbe", Seeded);
        var khujand = Branch.Create(organization.Id, "Филиал Худжанд", "KHJ", null, "Asia/Dushanbe", Seeded);
        context.Branches.AddRange(headOffice, khujand);

        var headCategory = Category.Create(organization.Id, headOffice.Id, "C#", null, Seeded);
        var khujandCategory = Category.Create(organization.Id, khujand.Id, "C#", null, Seeded);
        context.Categories.AddRange(headCategory, khujandCategory);

        context.CategorySettings.AddRange(
            CategorySettings.CreateDefault(headCategory, headOffice.TimeZoneId, Seeded),
            CategorySettings.CreateDefault(khujandCategory, khujand.TimeZoneId, Seeded));

        var organizationAdmin = User.CreateOrganizationAdmin(organization.Id, "Иван Каримов", OrganizationAdmin, Seeded);
        var branchAdmin = User.CreateBranchAdmin(organization.Id, headOffice.Id, "Дилшод Рахимов", BranchAdmin, Seeded);
        var lead = User.CreateLead(organization.Id, headOffice.Id, headCategory.Id, "Лид", Lead, Seeded);
        var mentor = User.CreateMentor(organization.Id, headOffice.Id, headCategory.Id, "Ментор", Mentor, Seeded);
        var secondMentor = User.CreateMentor(organization.Id, headOffice.Id, headCategory.Id, "Второй ментор", "mentor2-head@mentortaskflow.test", Seeded);
        var khujandMentor = User.CreateMentor(organization.Id, khujand.Id, khujandCategory.Id, "Ментор Худжанда", "mentor-khujand@mentortaskflow.test", Seeded);

        var users = new List<User> { organizationAdmin, branchAdmin, lead, mentor, secondMentor, khujandMentor };

        foreach (var user in users)
        {
            user.SetPasswordHash(passwordHash, Seeded);
        }

        context.Users.AddRange(users);
        await context.SaveChangesAsync();

        _branchAdminId = branchAdmin.Id;
        _leadId = lead.Id;
        _mentorId = mentor.Id;
        _secondMentorId = secondMentor.Id;
        _khujandMentorId = khujandMentor.Id;
    }
}
