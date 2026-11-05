using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.UnitTests.Assignments;

/// <summary>The deadline of published work moves only while the work is with its executor.</summary>
public sealed class AssignmentRescheduleTests
{
    private const string Reason = "Лид в отпуске до среды";

    private static readonly DateTimeOffset Now = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DueAt = Now.AddDays(3);

    private static Assignment Published()
    {
        var assignment = Assignment.CreateDraft(
            Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(),
            Guid.CreateVersion7(), Guid.CreateVersion7(), null, "Задача", null, DueAt, Now);

        assignment.Publish(Guid.CreateVersion7(), Now);

        return assignment;
    }

    [Fact]
    public void Moving_the_deadline_keeps_the_original_on_record()
    {
        var assignment = Published();

        var previous = assignment.Reschedule(DueAt.AddDays(2), Reason, Now);

        previous.ShouldBe(DueAt);
        assignment.CurrentDueAt.ShouldBe(DueAt.AddDays(2));
        assignment.InitialDueAt.ShouldBe(DueAt);
        assignment.Status.ShouldBe(AssignmentStatus.Assigned);
    }

    [Fact]
    public void A_deadline_can_also_be_brought_forward()
    {
        var assignment = Published();

        assignment.Reschedule(DueAt.AddDays(-1), Reason, Now);

        assignment.CurrentDueAt.ShouldBeLessThan(assignment.InitialDueAt);
    }

    /// <summary>Otherwise rescheduling would be a way to wash a slip out of <c>OverdueRate</c>.</summary>
    [Fact]
    public void An_overdue_task_returns_to_work_but_the_slip_stays_on_record()
    {
        var assignment = Published();
        var slippedAt = DueAt.AddHours(1);
        assignment.MarkOverdue(slippedAt);

        var later = slippedAt.AddHours(1);
        assignment.Reschedule(later.AddDays(2), Reason, later);

        assignment.Status.ShouldBe(AssignmentStatus.Assigned);
        assignment.OverdueAt.ShouldBe(slippedAt);
    }

    [Fact]
    public void Overdue_rework_returns_to_rework()
    {
        var assignment = Published();
        assignment.Submit(isFirstVersion: true, Now.AddHours(1));
        assignment.StartReview(Now.AddHours(2));
        assignment.RequestRework(DueAt, Now.AddHours(3));
        assignment.MarkOverdue(DueAt.AddHours(1));

        var later = DueAt.AddHours(2);
        assignment.Reschedule(later.AddDays(1), Reason, later);

        assignment.Status.ShouldBe(AssignmentStatus.NeedsRework);
    }

    [Fact]
    public void Work_that_was_handed_in_has_no_deadline_left_to_move()
    {
        var assignment = Published();
        assignment.Submit(isFirstVersion: true, Now.AddHours(1));

        Should.Throw<DomainException>(() => assignment.Reschedule(DueAt.AddDays(1), Reason, Now.AddHours(2)))
            .Code.ShouldBe(DomainErrorCodes.DeadlineChangeNotAllowed);

        assignment.StartReview(Now.AddHours(2));

        Should.Throw<DomainException>(() => assignment.Reschedule(DueAt.AddDays(1), Reason, Now.AddHours(3)))
            .Code.ShouldBe(DomainErrorCodes.DeadlineChangeNotAllowed);
    }

    [Fact]
    public void A_finished_task_cannot_be_moved()
    {
        var assignment = Published();
        assignment.Cancel(Guid.CreateVersion7(), "Больше не нужно", Now);

        Should.Throw<DomainException>(() => assignment.Reschedule(DueAt.AddDays(1), Reason, Now))
            .Code.ShouldBe(DomainErrorCodes.AssignmentTerminal);
    }

    [Fact]
    public void The_new_deadline_must_be_in_the_future() =>
        Should.Throw<DomainException>(() => Published().Reschedule(Now.AddMinutes(-1), Reason, Now))
            .Code.ShouldBe(DomainErrorCodes.ValidationFailed);

    [Fact]
    public void Moving_to_the_same_moment_is_refused() =>
        Should.Throw<DomainException>(() => Published().Reschedule(DueAt, Reason, Now))
            .Code.ShouldBe(DomainErrorCodes.ValidationFailed);

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("надо")]
    public void A_reason_is_required(string reason) =>
        Should.Throw<DomainException>(() => Published().Reschedule(DueAt.AddDays(1), reason, Now))
            .Code.ShouldBe(DomainErrorCodes.ValidationFailed);
}
