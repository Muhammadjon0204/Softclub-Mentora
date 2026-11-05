using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Common;
using MentorTaskFlow.Domain.Proposals;

namespace MentorTaskFlow.UnitTests.Proposals;

public sealed class ProposalTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);

    private static Proposal Pending() =>
        Proposal.Submit(
            Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(),
            ProposalKind.MasterClass, "Мастер-класс по Git", "Покажу ветки, rebase и разбор конфликтов.", Now.AddDays(7), Now);

    [Fact]
    public void A_new_proposal_waits_for_a_decision()
    {
        var proposal = Pending();

        proposal.Status.ShouldBe(ProposalStatus.Pending);
        proposal.DecidedById.ShouldBeNull();
        proposal.AssignmentId.ShouldBeNull();
    }

    [Fact]
    public void Approval_records_who_decided_and_what_it_became()
    {
        var proposal = Pending();
        var decider = Guid.CreateVersion7();
        var assignment = Guid.CreateVersion7();

        proposal.Approve(decider, assignment, null, Now);

        proposal.Status.ShouldBe(ProposalStatus.Approved);
        proposal.DecidedById.ShouldBe(decider);
        proposal.AssignmentId.ShouldBe(assignment);
    }

    [Fact]
    public void A_rejection_needs_a_reason() =>
        Should.Throw<DomainException>(() => Pending().Reject(Guid.CreateVersion7(), "нет", Now))
            .Code.ShouldBe(DomainErrorCodes.ValidationFailed);

    [Fact]
    public void Only_a_pending_proposal_can_change()
    {
        var proposal = Pending();
        proposal.Withdraw(Now);

        Should.Throw<DomainException>(() => proposal.Approve(Guid.CreateVersion7(), Guid.CreateVersion7(), null, Now))
            .Code.ShouldBe(DomainErrorCodes.ProposalNotPending);

        Should.Throw<DomainException>(() => proposal.Edit(ProposalKind.Other, "Новое название", "Новое описание идеи.", null, Now))
            .Code.ShouldBe(DomainErrorCodes.ProposalNotPending);
    }

    [Fact]
    public void The_assignment_of_a_proposal_is_published_at_once_and_says_where_it_came_from()
    {
        var assignment = Assignment.CreateFromProposal(
            Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(),
            Guid.CreateVersion7(), Guid.CreateVersion7(), "Мастер-класс", null, Now.AddDays(7), Now);

        assignment.Status.ShouldBe(AssignmentStatus.Assigned);
        assignment.Source.ShouldBe(AssignmentSource.Proposal);
        assignment.AssignedAt.ShouldBe(Now);
    }
}
