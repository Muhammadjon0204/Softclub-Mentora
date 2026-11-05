using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.Domain.Proposals;

/// <summary>What a mentor is offering to do.</summary>
public enum ProposalKind
{
    MasterClass = 0,
    ExtraLesson = 1,
    Other = 2,
}

/// <summary>Where a proposal stands. Everything except <see cref="Pending"/> is final.</summary>
public enum ProposalStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Withdrawn = 3,
}

/// <summary>
/// An idea a mentor put forward: a master class, extra lessons, anything of their own.
/// </summary>
/// <remarks>
/// <para>
/// The scope fields are a snapshot of the author's branch and category at the moment of writing, the
/// same immutable snapshot an assignment keeps (<c>TEN-018</c>).
/// </para>
/// <para>
/// Approval turns it into ordinary work: the proposal records which assignment it became, and from
/// then on the assignment's state machine is the only source of truth for how the work is going.
/// </para>
/// </remarks>
public sealed class Proposal : AuditableEntity
{
    public const int TitleMinLength = 3;
    public const int TitleMaxLength = 200;
    public const int DescriptionMinLength = 10;
    public const int DescriptionMaxLength = 2000;
    public const int DecisionCommentMinLength = 5;
    public const int DecisionCommentMaxLength = 500;

    public Guid OrganizationId { get; private set; }

    public Guid BranchId { get; private set; }

    public Guid CategoryId { get; private set; }

    public Guid AuthorId { get; private set; }

    public ProposalKind Kind { get; private set; }

    public string Title { get; private set; } = null!;

    public string Description { get; private set; } = null!;

    /// <summary>When the mentor would like to do it. A wish, not a deadline: the decider sets that.</summary>
    public DateTimeOffset? PreferredAt { get; private set; }

    public ProposalStatus Status { get; private set; }

    public Guid? DecidedById { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    /// <summary>Required for a rejection: a mentor told «no» without a reason cannot do better next time.</summary>
    public string? DecisionComment { get; private set; }

    /// <summary>Set by an approval, and only by an approval.</summary>
    public Guid? AssignmentId { get; private set; }

    private Proposal()
    {
    }

    public static Proposal Submit(
        Guid organizationId,
        Guid branchId,
        Guid categoryId,
        Guid authorId,
        ProposalKind kind,
        string title,
        string description,
        DateTimeOffset? preferredAt,
        DateTimeOffset now)
    {
        if (organizationId == Guid.Empty || branchId == Guid.Empty || categoryId == Guid.Empty || authorId == Guid.Empty)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                "OrganizationId, BranchId, CategoryId и автор обязательны и определяются сервером.");
        }

        return new Proposal
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            CategoryId = categoryId,
            AuthorId = authorId,
            Kind = kind,
            Title = ValidateTitle(title),
            Description = ValidateDescription(description),
            PreferredAt = preferredAt,
            Status = ProposalStatus.Pending,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public void Edit(ProposalKind kind, string title, string description, DateTimeOffset? preferredAt, DateTimeOffset now)
    {
        EnsurePending();

        Kind = kind;
        Title = ValidateTitle(title);
        Description = ValidateDescription(description);
        PreferredAt = preferredAt;
        UpdatedAt = now;
    }

    public void Withdraw(DateTimeOffset now)
    {
        EnsurePending();

        Status = ProposalStatus.Withdrawn;
        UpdatedAt = now;
    }

    /// <param name="assignmentId">The assignment the proposal became, created in the same transaction.</param>
    public void Approve(Guid decidedById, Guid assignmentId, string? comment, DateTimeOffset now)
    {
        EnsurePending();

        var trimmed = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();

        if (trimmed is { Length: > DecisionCommentMaxLength })
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"Комментарий не длиннее {DecisionCommentMaxLength} символов.");
        }

        Status = ProposalStatus.Approved;
        DecidedById = decidedById;
        DecidedAt = now;
        DecisionComment = trimmed;
        AssignmentId = assignmentId;
        UpdatedAt = now;
    }

    public void Reject(Guid decidedById, string comment, DateTimeOffset now)
    {
        EnsurePending();

        var trimmed = (comment ?? string.Empty).Trim();

        if (trimmed.Length is < DecisionCommentMinLength or > DecisionCommentMaxLength)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"Причина отказа обязательна: от {DecisionCommentMinLength} до {DecisionCommentMaxLength} символов.");
        }

        Status = ProposalStatus.Rejected;
        DecidedById = decidedById;
        DecidedAt = now;
        DecisionComment = trimmed;
        UpdatedAt = now;
    }

    private void EnsurePending()
    {
        if (Status is not ProposalStatus.Pending)
        {
            throw new DomainException(
                DomainErrorCodes.ProposalNotPending,
                "Предложение уже рассмотрено или отозвано.",
                new Dictionary<string, object?> { ["currentStatus"] = Status.ToString() });
        }
    }

    private static string ValidateTitle(string title)
    {
        var trimmed = (title ?? string.Empty).Trim();

        return trimmed.Length is >= TitleMinLength and <= TitleMaxLength
            ? trimmed
            : throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"Название должно содержать от {TitleMinLength} до {TitleMaxLength} символов.");
    }

    private static string ValidateDescription(string description)
    {
        var trimmed = (description ?? string.Empty).Trim();

        return trimmed.Length is >= DescriptionMinLength and <= DescriptionMaxLength
            ? trimmed
            : throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"Описание должно содержать от {DescriptionMinLength} до {DescriptionMaxLength} символов.");
    }
}
