using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.UnitTests.Assignments;

/// <summary>
/// The text of published work can be corrected — a typo, a missing link — but only until the executor
/// hands something in: after that it is what the work was done against.
/// </summary>
public sealed class AssignmentEditDetailsTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 13, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DueAt = Now.AddDays(3);

    private static Assignment Published()
    {
        var assignment = Assignment.CreateDraft(
            Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(),
            Guid.CreateVersion7(), Guid.CreateVersion7(), null, "Мидлвар для логирования", "Старое описание", DueAt, Now);

        assignment.Publish(Guid.CreateVersion7(), Now);

        return assignment;
    }

    [Fact]
    public void A_typo_in_published_work_can_be_fixed()
    {
        var assignment = Published();

        var previous = assignment.EditDetails("Middleware для логирования", "Новое описание со ссылкой", Now.AddHours(1));

        previous.ShouldBe("Мидлвар для логирования");
        assignment.Title.ShouldBe("Middleware для логирования");
        assignment.Description.ShouldBe("Новое описание со ссылкой");
        assignment.Status.ShouldBe(AssignmentStatus.Assigned);
    }

    [Fact]
    public void The_deadline_is_not_touched()
    {
        var assignment = Published();

        assignment.EditDetails("Middleware для логирования", null, Now.AddHours(1));

        assignment.CurrentDueAt.ShouldBe(DueAt);
        assignment.InitialDueAt.ShouldBe(DueAt);
    }

    [Fact]
    public void Overdue_work_that_was_never_handed_in_can_still_be_corrected()
    {
        var assignment = Published();
        assignment.MarkOverdue(DueAt.AddHours(1));

        assignment.EditDetails("Middleware для логирования", null, DueAt.AddHours(2));

        assignment.Title.ShouldBe("Middleware для логирования");
        assignment.Status.ShouldBe(AssignmentStatus.Overdue);
    }

    [Fact]
    public void Once_something_was_handed_in_the_text_is_closed()
    {
        var assignment = Published();
        assignment.Submit(isFirstVersion: true, Now.AddHours(1));

        Should.Throw<DomainException>(() => assignment.EditDetails("Другое", null, Now.AddHours(2)))
            .Code.ShouldBe(DomainErrorCodes.DetailsChangeNotAllowed);

        assignment.StartReview(Now.AddHours(2));
        assignment.RequestRework(DueAt, Now.AddHours(3));

        // Back with the executor, but the first version was done against the current text.
        Should.Throw<DomainException>(() => assignment.EditDetails("Другое", null, Now.AddHours(4)))
            .Code.ShouldBe(DomainErrorCodes.DetailsChangeNotAllowed);
    }

    [Fact]
    public void A_cancelled_task_cannot_be_edited()
    {
        var assignment = Published();
        assignment.Cancel(Guid.CreateVersion7(), "Больше не нужно", Now);

        Should.Throw<DomainException>(() => assignment.EditDetails("Другое", null, Now))
            .Code.ShouldBe(DomainErrorCodes.AssignmentTerminal);
    }

    [Fact]
    public void Saving_the_same_text_is_refused() =>
        Should.Throw<DomainException>(() => Published().EditDetails(" Мидлвар для логирования ", "Старое описание", Now))
            .Code.ShouldBe(DomainErrorCodes.ValidationFailed);

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void The_title_is_still_validated(string title) =>
        Should.Throw<DomainException>(() => Published().EditDetails(title, null, Now))
            .Code.ShouldBe(DomainErrorCodes.ValidationFailed);
}
