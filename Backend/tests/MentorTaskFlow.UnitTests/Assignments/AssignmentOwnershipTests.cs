using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Assignments;

namespace MentorTaskFlow.UnitTests.Assignments;

/// <summary>Whoever handed the work out leads it, and everybody above them only watches.</summary>
public sealed class AssignmentOwnershipTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Org = Guid.CreateVersion7();
    private static readonly Guid BranchId = Guid.CreateVersion7();
    private static readonly Guid OtherBranch = Guid.CreateVersion7();
    private static readonly Guid CategoryId = Guid.CreateVersion7();
    private static readonly Guid OtherCategory = Guid.CreateVersion7();
    private static readonly Guid MentorId = Guid.CreateVersion7();
    private static readonly Guid LeadId = Guid.CreateVersion7();
    private static readonly Guid AdminId = Guid.CreateVersion7();

    private static readonly AssignerInfo ActiveLead = new(UserRole.Lead, true);
    private static readonly AssignerInfo ActiveAdmin = new(UserRole.Admin, true);
    private static readonly AssignerInfo GoneAdmin = new(UserRole.Admin, false);

    private static Assignment Work(Guid assignedBy, Guid? assignedTo = null) =>
        Assignment.CreateDraft(Org, BranchId, CategoryId, assignedTo ?? MentorId, assignedBy, null, "Задача", null, Now.AddDays(3), Now);

    private static Actor Lead(Guid? id = null, Guid? category = null) =>
        new(id ?? LeadId, UserRole.Lead, null, Org, BranchId, category ?? CategoryId);

    private static Actor BranchAdmin(Guid? id = null, Guid? branch = null) =>
        new(id ?? AdminId, UserRole.Admin, AdminScope.Branch, Org, branch ?? BranchId, null);

    private static Actor OrganizationAdmin(Guid? id = null) =>
        new(id ?? AdminId, UserRole.Admin, AdminScope.Organization, Org, null, null);

    [Fact]
    public void The_lead_leads_what_a_lead_handed_out() =>
        AssignmentOwnership.IsOwner(Lead(), Work(LeadId), ActiveLead).ShouldBeTrue();

    /// <summary>The user's rule: an administrator does not know what a Lead asked for.</summary>
    [Fact]
    public void An_administrator_does_not_lead_what_a_lead_handed_out()
    {
        AssignmentOwnership.IsOwner(BranchAdmin(), Work(LeadId), ActiveLead).ShouldBeFalse();
        AssignmentOwnership.IsOwner(OrganizationAdmin(), Work(LeadId), ActiveLead).ShouldBeFalse();
    }

    [Fact]
    public void A_branch_admin_leads_only_what_they_handed_out_and_their_superior_does_not()
    {
        var work = Work(AdminId);

        AssignmentOwnership.IsOwner(BranchAdmin(), work, ActiveAdmin).ShouldBeTrue();
        AssignmentOwnership.IsOwner(OrganizationAdmin(Guid.CreateVersion7()), work, ActiveAdmin).ShouldBeFalse();
    }

    [Fact]
    public void The_lead_of_the_category_does_not_lead_an_administrators_task() =>
        AssignmentOwnership.IsOwner(Lead(), Work(AdminId), ActiveAdmin).ShouldBeFalse();

    /// <summary>Otherwise everything a Lead ever handed out would freeze the day they were replaced.</summary>
    [Fact]
    public void A_new_lead_inherits_the_tasks_of_the_previous_one() =>
        AssignmentOwnership.IsOwner(Lead(Guid.CreateVersion7()), Work(LeadId), ActiveLead).ShouldBeTrue();

    [Fact]
    public void A_lead_of_another_category_leads_nothing_here() =>
        AssignmentOwnership.IsOwner(Lead(Guid.CreateVersion7(), OtherCategory), Work(LeadId), ActiveLead).ShouldBeFalse();

    [Fact]
    public void Nobody_leads_their_own_task() =>
        AssignmentOwnership.IsOwner(Lead(), Work(AdminId, assignedTo: LeadId), ActiveAdmin).ShouldBeFalse();

    /// <summary>A suggestion has no assigner yet, and it is the category's to accept.</summary>
    [Fact]
    public void An_unaccepted_suggestion_belongs_to_the_lead() =>
        AssignmentOwnership.IsOwner(Lead(), Work(LeadId), null).ShouldBeTrue();

    [Fact]
    public void A_deactivated_administrators_task_passes_to_an_administrator_who_can_reach_it()
    {
        var work = Work(AdminId);
        var colleague = Guid.CreateVersion7();

        AssignmentOwnership.IsOwner(BranchAdmin(colleague), work, GoneAdmin).ShouldBeTrue();
        AssignmentOwnership.IsOwner(OrganizationAdmin(colleague), work, GoneAdmin).ShouldBeTrue();
        AssignmentOwnership.IsOwner(BranchAdmin(colleague, OtherBranch), work, GoneAdmin).ShouldBeFalse();
    }

    private sealed record Actor(
        Guid UserId,
        UserRole Role,
        AdminScope? AdminScope,
        Guid OrganizationId,
        Guid? BranchId,
        Guid? CategoryId,
        int TokenVersion = 1) : ICurrentUserContext;
}
