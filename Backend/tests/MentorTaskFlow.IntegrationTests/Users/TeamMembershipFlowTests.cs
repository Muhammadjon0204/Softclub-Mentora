using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MentorTaskFlow.Contracts.Assignments;
using MentorTaskFlow.Contracts.Auth;
using MentorTaskFlow.Contracts.Categories;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Proposals;
using MentorTaskFlow.Contracts.Reviews;
using MentorTaskFlow.Contracts.Submissions;
using MentorTaskFlow.Contracts.Users;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Identity;
using MentorTaskFlow.IntegrationTests.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.IntegrationTests.Users;

/// <summary>
/// One person in several teams: a branch administrator who takes part in a team, a mentor who teaches
/// in two, and what each lead may see and do about them.
/// </summary>
/// <remarks>
/// Against a real database on purpose: the scope and «one lead per team» triggers decide as much as the
/// services do.
/// </remarks>
[Collection(PostgresCollection.Name)]
public sealed class TeamMembershipFlowTests(PostgresFixture postgres, MinioFixture minio) : IAsyncLifetime
{
    private const string ValidPassword = "Karimov2026Task";
    private const string TeamHeader = "X-MTF-Team-Id";
    private const string OrganizationAdmin = "organization-admin@mentortaskflow.test";
    private const string BranchAdmin = "branch-admin-head@mentortaskflow.test";
    private const string OtherBranchAdmin = "branch-admin-khujand@mentortaskflow.test";
    private const string CodeLead = "lead-code@mentortaskflow.test";
    private const string SmmLead = "lead-smm@mentortaskflow.test";
    private const string Mentor = "mentor-head@mentortaskflow.test";
    private const string SecondMentor = "mentor2-head@mentortaskflow.test";

    private static readonly DateTimeOffset Seeded = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset InAWeek = DateTimeOffset.UtcNow.AddDays(7);

    private MentorTaskFlowApiFactory _factory = null!;
    private Guid _khujandBranchId;
    private Guid _code;
    private Guid _smm;
    private Guid _qa;
    private Guid _khujandTeam;
    private Guid _organizationAdminId;
    private Guid _branchAdminId;
    private Guid _codeLeadId;
    private Guid _smmLeadId;
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
    // A branch administrator in a team
    // -----------------------------------------------------------------

    [Fact]
    public async Task A_branch_admin_added_as_a_participant_does_the_work_in_that_team_and_the_lead_reviews_it()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        (await AddAsync(owner, _smm, _branchAdminId, "Member")).StatusCode.ShouldBe(HttpStatusCode.OK);

        using var lead = await SignInAsync(SmmLead);
        var work = await PublishedAsync(lead, _branchAdminId);
        work.CategoryId.ShouldBe(_smm);

        // From their administrator's seat they are not an executor.
        using var admin = await SignInAsync(BranchAdmin);
        (await UploadAsync(admin, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        using var participant = await SignInAsync(BranchAdmin, _smm);
        (await UploadAsync(participant, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);

        (await StartReviewAsync(lead, work.Id)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await DecideAsync(lead, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Acting_in_a_team_drops_the_administrators_rights_for_that_request()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _branchAdminId, "Member");

        using var lead = await SignInAsync(SmmLead);
        var own = await PublishedAsync(lead, _branchAdminId);

        using var codeLead = await SignInAsync(CodeLead);
        var foreign = await PublishedAsync(codeLead, _mentorId);

        using var participant = await SignInAsync(BranchAdmin, _smm);

        (await participant.GetAsync("/api/v1/users")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await participant.GetAsync($"/api/v1/assignments/{foreign.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var list = await ReadAsync<PagedResult<AssignmentDto>>(await participant.GetAsync("/api/v1/assignments"));
        list.Items.Select(a => a.Id).ShouldBe([own.Id]);
    }

    [Fact]
    public async Task The_profile_lists_every_team_with_the_role_and_rights_there()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Member");
        await AddAsync(owner, _qa, _mentorId, "Lead");

        using var mentor = await SignInAsync(Mentor);
        var me = await ReadAsync<AuthUserDto>(await mentor.GetAsync("/api/v1/auth/me"));

        me.Role.ShouldBe(nameof(UserRole.Mentor));
        me.Teams.ShouldNotBeNull();
        me.Teams.Select(t => (t.CategoryId, t.Role, t.IsMain)).ShouldBe(
            [(_code, "Mentor", true), (_qa, "Lead", false), (_smm, "Member", false)]);

        me.Teams.Single(t => t.CategoryId == _qa).Permissions.ShouldContain("assignments.review");
        me.Teams.Single(t => t.CategoryId == _smm).Permissions.ShouldNotContain("assignments.review");
    }

    [Theory]
    [InlineData(Mentor)]
    [InlineData(OrganizationAdmin)]
    [InlineData(OtherBranchAdmin)]
    public async Task Naming_a_team_one_does_not_belong_to_is_refused(string email)
    {
        using var client = await SignInAsync(email, _smm);

        var response = await client.GetAsync("/api/v1/assignments");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadCodeAsync(response)).ShouldBe(ErrorCodes.ScopeOverrideForbidden);
    }

    // -----------------------------------------------------------------
    // A mentor in two teams
    // -----------------------------------------------------------------

    [Fact]
    public async Task Each_lead_sees_only_their_own_teams_work_of_a_shared_mentor()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Mentor");

        using var codeLead = await SignInAsync(CodeLead);
        using var smmLead = await SignInAsync(SmmLead);
        var code = await PublishedAsync(codeLead, _mentorId);
        var smm = await PublishedAsync(smmLead, _mentorId);

        (await smmLead.GetAsync($"/api/v1/assignments/{code.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await codeLead.GetAsync($"/api/v1/assignments/{smm.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var seenBySmm = await ReadAsync<PagedResult<AssignmentDto>>(
            await smmLead.GetAsync($"/api/v1/assignments?assignedToId={_mentorId}"));
        seenBySmm.Items.Select(a => a.Id).ShouldBe([smm.Id]);

        // The mentor sees both without switching, and hands both in.
        using var mentor = await SignInAsync(Mentor);
        var own = await ReadAsync<PagedResult<AssignmentDto>>(await mentor.GetAsync("/api/v1/assignments"));
        own.Items.Select(a => a.Id).ShouldBe([code.Id, smm.Id], ignoreOrder: true);

        (await UploadAsync(mentor, smm.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await StartReviewAsync(smmLead, smm.Id)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await DecideAsync(smmLead, smm.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task A_lead_is_told_of_their_own_team_only()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Mentor");

        using var smmLead = await SignInAsync(SmmLead);
        var people = await ReadAsync<PagedResult<UserDto>>(await smmLead.GetAsync("/api/v1/users?pageSize=50"));

        var shared = people.Items.Single(u => u.Id == _mentorId);
        shared.Teams.ShouldNotBeNull().Select(t => t.CategoryId).ShouldBe([_smm]);
        people.Items.ShouldNotContain(u => u.Id == _secondMentorId);

        var asAdmin = await ReadAsync<UserDto>(await owner.GetAsync($"/api/v1/users/{_mentorId}"));
        asAdmin.Teams.ShouldNotBeNull().Select(t => t.CategoryId).ShouldBe([_code, _smm]);
    }

    [Fact]
    public async Task An_administrator_names_the_team_for_somebody_in_several()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Mentor");

        using var admin = await SignInAsync(BranchAdmin);

        (await PublishedAsync(admin, _mentorId)).CategoryId.ShouldBe(_code);
        (await PublishedAsync(admin, _mentorId, _smm)).CategoryId.ShouldBe(_smm);

        var outside = await DraftAsync(admin, _mentorId, _qa);
        outside.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(outside)).ShouldBe(ErrorCodes.CrossScopeReference);
    }

    [Fact]
    public async Task Somebody_with_several_teams_and_no_main_one_needs_the_team_named()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _branchAdminId, "Member");

        // One team is unambiguous.
        (await PublishedAsync(owner, _branchAdminId)).CategoryId.ShouldBe(_smm);

        await AddAsync(owner, _qa, _branchAdminId, "Member");

        (await DraftAsync(owner, _branchAdminId, null)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await PublishedAsync(owner, _branchAdminId, _qa)).CategoryId.ShouldBe(_qa);
    }

    [Fact]
    public async Task Nobody_gives_work_to_themselves()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _branchAdminId, "Member");

        using var admin = await SignInAsync(BranchAdmin);
        var response = await DraftAsync(admin, _branchAdminId, _smm);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    // -----------------------------------------------------------------
    // Leading a second team
    // -----------------------------------------------------------------

    [Fact]
    public async Task A_mentor_who_leads_another_team_hands_out_and_reviews_its_work_there_only()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _qa, _mentorId, "Lead");
        await AddAsync(owner, _qa, _secondMentorId, "Member");

        using var atHome = await SignInAsync(Mentor);
        (await DraftAsync(atHome, _secondMentorId, null)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        using var leading = await SignInAsync(Mentor, _qa);
        var work = await PublishedAsync(leading, _secondMentorId);
        work.CategoryId.ShouldBe(_qa);
        work.CanManage.ShouldBeTrue();

        using var participant = await SignInAsync(SecondMentor);
        (await UploadAsync(participant, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await StartReviewAsync(leading, work.Id)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await DecideAsync(leading, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task The_next_lead_takes_over_work_of_one_who_left_the_team()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _qa, _mentorId, "Lead");
        await AddAsync(owner, _qa, _secondMentorId, "Member");
        await AddAsync(owner, _qa, _codeLeadId, "Mentor");

        using var leading = await SignInAsync(Mentor, _qa);
        var work = await PublishedAsync(leading, _secondMentorId);

        (await owner.DeleteAsync($"/api/v1/categories/{_qa}/members/{_mentorId}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ChangeAsync(owner, _qa, _codeLeadId, "Lead")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // The former lead is out at once, with the token they already had.
        (await leading.GetAsync("/api/v1/assignments")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        using var next = await SignInAsync(CodeLead, _qa);
        var fresh = await ReadAsync<AssignmentDto>(await next.GetAsync($"/api/v1/assignments/{work.Id}"));
        fresh.CanManage.ShouldBeTrue();

        var rescheduled = await next.PostAsJsonAsync($"/api/v1/assignments/{work.Id}/reschedule",
            new RescheduleAssignmentRequest(InAWeek.AddDays(2), "Новый лид сдвигает срок", fresh.ConcurrencyToken));
        rescheduled.StatusCode.ShouldBe(HttpStatusCode.OK);

        var moved = await ReadAsync<AssignmentDto>(rescheduled);
        var reassigned = await next.PostAsJsonAsync($"/api/v1/assignments/{work.Id}/reassign",
            new ReassignAssignmentRequest(_codeLeadId, moved.ConcurrencyToken));
        reassigned.StatusCode.ShouldBe(HttpStatusCode.Conflict, "a lead does not hand work to themselves");
    }

    [Fact]
    public async Task A_team_has_one_lead_however_they_were_appointed()
    {
        using var owner = await SignInAsync(OrganizationAdmin);

        var second = await AddAsync(owner, _smm, _mentorId, "Lead");
        second.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(second)).ShouldBe(ErrorCodes.ActiveLeadAlreadyExists);

        (await AddAsync(owner, _qa, _mentorId, "Lead")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // The account route to the same seat is closed by the database trigger.
        var user = await ReadAsync<UserDto>(await owner.GetAsync($"/api/v1/users/{_secondMentorId}"));
        var promoted = await owner.PostAsJsonAsync($"/api/v1/users/{_secondMentorId}/change-role",
            new ChangeRoleRequest("Lead", "Новый руководитель QA", user.ConcurrencyToken, CategoryId: _qa));

        promoted.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(promoted)).ShouldBe(ErrorCodes.ActiveLeadAlreadyExists);
    }

    // -----------------------------------------------------------------
    // Who manages the members
    // -----------------------------------------------------------------

    [Fact]
    public async Task A_lead_adds_mentors_and_participants_but_no_administrators_or_leads()
    {
        using var lead = await SignInAsync(SmmLead);

        var candidates = await ReadAsync<List<TeamCandidateDto>>(
            await lead.GetAsync($"/api/v1/categories/{_smm}/member-candidates"));

        candidates.ShouldNotContain(c => c.UserId == _branchAdminId);
        candidates.ShouldNotContain(c => c.UserId == _khujandMentorId);
        candidates.Single(c => c.UserId == _mentorId).AssignableRoles.ShouldBe(["Mentor", "Member"]);
        candidates.Single(c => c.UserId == _mentorId).MainTeamName.ShouldBeNull();

        (await AddAsync(lead, _smm, _mentorId, "Member")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await AddAsync(lead, _smm, _branchAdminId, "Member")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await AddAsync(lead, _smm, _secondMentorId, "Lead")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await AddAsync(lead, _code, _secondMentorId, "Mentor")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        (await ChangeAsync(lead, _smm, _mentorId, "Mentor")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await lead.DeleteAsync($"/api/v1/categories/{_smm}/members/{_mentorId}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task A_lead_cannot_touch_an_administrator_in_their_team()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _branchAdminId, "Member");

        using var lead = await SignInAsync(SmmLead);
        var members = await ReadAsync<List<TeamMemberDto>>(await lead.GetAsync($"/api/v1/categories/{_smm}/members"));

        var admin = members.Single(m => m.UserId == _branchAdminId);
        admin.CanRemove.ShouldBeFalse();
        admin.AssignableRoles.ShouldBeEmpty();

        (await lead.DeleteAsync($"/api/v1/categories/{_smm}/members/{_branchAdminId}"))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await lead.DeleteAsync($"/api/v1/categories/{_smm}/members/{_smmLeadId}"))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task A_branch_admin_manages_their_own_branch_only_and_may_join_a_team_themselves()
    {
        using var admin = await SignInAsync(BranchAdmin);

        (await AddAsync(admin, _smm, _branchAdminId, "Member")).StatusCode.ShouldBe(HttpStatusCode.OK);

        var asMentor = await AddAsync(admin, _qa, _branchAdminId, "Mentor");
        asMentor.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var stranger = await AddAsync(admin, _smm, _khujandMentorId, "Mentor");
        stranger.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(stranger)).ShouldBe(ErrorCodes.CrossScopeReference);

        (await AddAsync(admin, _khujandTeam, _mentorId, "Mentor")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await AddAsync(admin, _smm, _organizationAdminId, "Member")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task A_mentor_has_no_say_in_who_is_in_a_team()
    {
        using var mentor = await SignInAsync(Mentor);

        (await mentor.GetAsync($"/api/v1/categories/{_code}/members")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await AddAsync(mentor, _code, _secondMentorId, "Member")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Somebody_with_unfinished_work_stays_in_the_team_until_it_is_closed()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Mentor");

        using var lead = await SignInAsync(SmmLead);
        var work = await PublishedAsync(lead, _mentorId);

        var blocked = await owner.DeleteAsync($"/api/v1/categories/{_smm}/members/{_mentorId}");
        blocked.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(blocked)).ShouldBe(ErrorCodes.CategoryChangeBlocked);

        using var mentor = await SignInAsync(Mentor);
        await UploadAsync(mentor, work.Id);
        await StartReviewAsync(lead, work.Id);
        await DecideAsync(lead, work.Id);

        (await owner.DeleteAsync($"/api/v1/categories/{_smm}/members/{_mentorId}"))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task A_participant_is_listed_as_one_and_is_not_counted_among_the_mentors()
    {
        using var lead = await SignInAsync(SmmLead);

        var created = await lead.PostAsJsonAsync("/api/v1/users",
            new CreateUserRequest("Контент-мейкер", "content@mentortaskflow.test", "Mentor", TeamRole: "Member"));
        created.StatusCode.ShouldBe(HttpStatusCode.Created);

        var person = await ReadAsync<UserDto>(created);
        person.Teams.ShouldNotBeNull().Single().Role.ShouldBe("Member");

        (await ChangeAsync(lead, _smm, person.Id, "Mentor")).StatusCode.ShouldBe(HttpStatusCode.OK);

        var members = await ReadAsync<List<TeamMemberDto>>(await lead.GetAsync($"/api/v1/categories/{_smm}/members"));
        var row = members.Single(m => m.UserId == person.Id);
        row.Role.ShouldBe("Mentor");
        row.IsMain.ShouldBeTrue();
        row.CanRemove.ShouldBeFalse();

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        (await context.TeamMemberships.AnyAsync(m => m.UserId == person.Id)).ShouldBeFalse();
    }

    [Fact]
    public async Task A_participant_proposes_work_to_their_second_team_and_its_lead_decides()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Member");

        using var participant = await SignInAsync(Mentor, _smm);
        var response = await participant.PostAsJsonAsync("/api/v1/proposals",
            new CreateProposalRequest("MasterClass", "Съёмка ролика", "Сниму ролик о занятиях.", InAWeek));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var proposal = await ReadAsync<ProposalDto>(response);
        proposal.CategoryId.ShouldBe(_smm);

        using var lead = await SignInAsync(SmmLead);
        var seen = await ReadAsync<ProposalDto>(await lead.GetAsync($"/api/v1/proposals/{proposal.Id}"));
        var approved = await lead.PostAsJsonAsync($"/api/v1/proposals/{proposal.Id}/approve",
            new ApproveProposalRequest(InAWeek, null, null, null, seen.ConcurrencyToken));

        approved.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    // -----------------------------------------------------------------
    // Accounts that change
    // -----------------------------------------------------------------

    [Fact]
    public async Task Deactivating_a_lead_of_two_teams_reports_both_as_left_without_one()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _qa, _smmLeadId, "Lead");

        var user = await ReadAsync<UserDto>(await owner.GetAsync($"/api/v1/users/{_smmLeadId}"));
        var response = await owner.PostAsJsonAsync($"/api/v1/users/{_smmLeadId}/deactivate",
            new UserActionRequest(user.ConcurrencyToken));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        var teams = await context.NotificationOutbox
            .Where(n => n.EventType == "CategoryWithoutLead" && n.UserId == _branchAdminId)
            .Select(n => n.CategoryId)
            .Distinct()
            .ToListAsync();

        teams.ShouldBe([_smm, _qa], ignoreOrder: true);
    }

    [Fact]
    public async Task A_move_to_another_branch_leaves_every_team_behind()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Mentor");

        var user = await ReadAsync<UserDto>(await owner.GetAsync($"/api/v1/users/{_mentorId}"));
        var moved = await owner.PostAsJsonAsync($"/api/v1/users/{_mentorId}/change-branch",
            new ChangeBranchRequest(_khujandBranchId, "Переезд в Худжанд", user.ConcurrencyToken, _khujandTeam));

        moved.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync<UserDto>(moved)).Teams.ShouldNotBeNull().Select(t => t.CategoryId).ShouldBe([_khujandTeam]);
    }

    [Fact]
    public async Task Leading_a_second_team_blocks_a_move_to_another_branch()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _qa, _mentorId, "Lead");

        var user = await ReadAsync<UserDto>(await owner.GetAsync($"/api/v1/users/{_mentorId}"));
        var moved = await owner.PostAsJsonAsync($"/api/v1/users/{_mentorId}/change-branch",
            new ChangeBranchRequest(_khujandBranchId, "Переезд в Худжанд", user.ConcurrencyToken, _khujandTeam));

        moved.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadCodeAsync(moved)).ShouldBe(ErrorCodes.BranchChangeBlocked);
    }

    [Fact]
    public async Task Work_in_a_second_team_does_not_stop_the_main_team_from_changing()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _mentorId, "Mentor");

        using var lead = await SignInAsync(SmmLead);
        var work = await PublishedAsync(lead, _mentorId);

        var user = await ReadAsync<UserDto>(await owner.GetAsync($"/api/v1/users/{_mentorId}"));
        var moved = await owner.PostAsJsonAsync($"/api/v1/users/{_mentorId}/change-category",
            new ChangeCategoryRequest(_qa, "Переходит в тестирование", user.ConcurrencyToken));

        moved.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync<UserDto>(moved)).Teams.ShouldNotBeNull().Select(t => t.CategoryId).ShouldBe([_qa, _smm]);

        using var again = await SignInAsync(Mentor);
        (await UploadAsync(again, work.Id)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task A_participant_of_another_team_is_linked_to_that_teams_page_in_notifications()
    {
        using var owner = await SignInAsync(OrganizationAdmin);
        await AddAsync(owner, _smm, _branchAdminId, "Member");

        using var lead = await SignInAsync(SmmLead);
        var work = await PublishedAsync(lead, _branchAdminId);

        await using var context = postgres.CreateContext(suppressTenantFilter: true);
        var payloads = await context.NotificationOutbox
            .Where(n => n.UserId == _branchAdminId)
            .Select(n => n.Payload)
            .ToListAsync();

        payloads
            .Select(p => p.RootElement.TryGetProperty("actionPath", out var path) ? path.GetString() : null)
            .ShouldContain($"/mentor/tasks?assignmentId={work.Id}&team={_smm}");
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private static Task<HttpResponseMessage> AddAsync(HttpClient client, Guid teamId, Guid userId, string role) =>
        client.PostAsJsonAsync($"/api/v1/categories/{teamId}/members", new AddTeamMemberRequest(userId, role));

    private static Task<HttpResponseMessage> ChangeAsync(HttpClient client, Guid teamId, Guid userId, string role) =>
        client.PutAsJsonAsync($"/api/v1/categories/{teamId}/members/{userId}", new ChangeTeamMemberRoleRequest(role));

    private static Task<HttpResponseMessage> DraftAsync(HttpClient client, Guid assigneeId, Guid? teamId) =>
        client.PostAsJsonAsync("/api/v1/assignments/drafts",
            new CreateAssignmentDraftRequest(assigneeId, null, "Подготовить отчёт", null, InAWeek, teamId));

    private static async Task<AssignmentDto> PublishedAsync(HttpClient client, Guid assigneeId, Guid? teamId = null)
    {
        var created = await DraftAsync(client, assigneeId, teamId);
        created.StatusCode.ShouldBe(HttpStatusCode.Created);

        var draft = await ReadAsync<AssignmentDto>(created);
        var published = await client.PostAsJsonAsync(
            $"/api/v1/assignments/{draft.Id}/publish",
            new AssignmentActionRequest(draft.ConcurrencyToken));
        published.StatusCode.ShouldBe(HttpStatusCode.OK);

        return await ReadAsync<AssignmentDto>(published);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient executor, Guid assignmentId)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes("%PDF-1.7\nсодержимое работы\ntrailer\n%%EOF\n"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "работа.pdf");

        return await executor.PostAsync($"/api/v1/assignments/{assignmentId}/submissions", form);
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

    private async Task<HttpClient> SignInAsync(string email, Guid? teamId = null)
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, ValidPassword));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        client.DefaultRequestHeaders.Authorization =
            new("Bearer", (await ReadAsync<LoginResponse>(response)).AccessToken);

        if (teamId is { } team)
        {
            client.DefaultRequestHeaders.Add(TeamHeader, team.ToString());
        }

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

        var code = Category.Create(organization.Id, headOffice.Id, "C#", null, Seeded);
        var smm = Category.Create(organization.Id, headOffice.Id, "SMM", null, Seeded);
        var qa = Category.Create(organization.Id, headOffice.Id, "QA", null, Seeded);
        var khujandTeam = Category.Create(organization.Id, khujand.Id, "C#", null, Seeded);
        context.Categories.AddRange(code, smm, qa, khujandTeam);

        foreach (var category in new[] { code, smm, qa })
        {
            context.CategorySettings.Add(CategorySettings.CreateDefault(category, headOffice.TimeZoneId, Seeded));
        }

        context.CategorySettings.Add(CategorySettings.CreateDefault(khujandTeam, khujand.TimeZoneId, Seeded));

        var organizationAdmin = User.CreateOrganizationAdmin(organization.Id, "Иван Каримов", OrganizationAdmin, Seeded);
        var branchAdmin = User.CreateBranchAdmin(organization.Id, headOffice.Id, "Дилшод Рахимов", BranchAdmin, Seeded);
        var otherBranchAdmin = User.CreateBranchAdmin(organization.Id, khujand.Id, "Админ Худжанда", OtherBranchAdmin, Seeded);
        var codeLead = User.CreateLead(organization.Id, headOffice.Id, code.Id, "Лид кода", CodeLead, Seeded);
        var smmLead = User.CreateLead(organization.Id, headOffice.Id, smm.Id, "Лид SMM", SmmLead, Seeded);
        var mentor = User.CreateMentor(organization.Id, headOffice.Id, code.Id, "Ментор", Mentor, Seeded);
        var secondMentor = User.CreateMentor(organization.Id, headOffice.Id, code.Id, "Второй ментор", SecondMentor, Seeded);
        var khujandMentor = User.CreateMentor(organization.Id, khujand.Id, khujandTeam.Id, "Ментор Худжанда", "mentor-khujand@mentortaskflow.test", Seeded);

        var users = new List<User>
        {
            organizationAdmin, branchAdmin, otherBranchAdmin, codeLead, smmLead, mentor, secondMentor, khujandMentor,
        };

        foreach (var user in users)
        {
            user.SetPasswordHash(passwordHash, Seeded);
        }

        context.Users.AddRange(users);
        await context.SaveChangesAsync();

        _khujandBranchId = khujand.Id;
        _code = code.Id;
        _smm = smm.Id;
        _qa = qa.Id;
        _khujandTeam = khujandTeam.Id;
        _organizationAdminId = organizationAdmin.Id;
        _branchAdminId = branchAdmin.Id;
        _codeLeadId = codeLead.Id;
        _smmLeadId = smmLead.Id;
        _mentorId = mentor.Id;
        _secondMentorId = secondMentor.Id;
        _khujandMentorId = khujandMentor.Id;
    }
}
