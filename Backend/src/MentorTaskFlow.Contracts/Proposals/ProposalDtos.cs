namespace MentorTaskFlow.Contracts.Proposals;

/// <summary>A mentor's proposal as returned by the API.</summary>
public sealed record ProposalDto(
    Guid Id,
    Guid BranchId,
    Guid CategoryId,
    string CategoryName,
    Guid AuthorId,
    string AuthorFullName,
    string Kind,
    string Title,
    string Description,
    DateTimeOffset? PreferredAt,
    string Status,
    Guid? DecidedById,
    string? DecidedByFullName,
    DateTimeOffset? DecidedAt,
    string? DecisionComment,
    Guid? AssignmentId,
    DateTimeOffset CreatedAt,
    string ConcurrencyToken,
    bool CanDecide);

public sealed record ProposalListQuery
{
    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 20;

    public string? Status { get; init; }
}

/// <summary><c>POST /proposals</c>. The author and their scope come from the token (<c>SEC-003</c>).</summary>
public sealed record CreateProposalRequest(
    string Kind,
    string Title,
    string Description,
    DateTimeOffset? PreferredAt);

/// <summary><c>PUT /proposals/{id}</c> — the author, while nobody has decided yet.</summary>
public sealed record UpdateProposalRequest(
    string Kind,
    string Title,
    string Description,
    DateTimeOffset? PreferredAt,
    string ConcurrencyToken);

public sealed record ProposalActionRequest(string ConcurrencyToken);

/// <summary>
/// <c>POST /proposals/{id}/approve</c>. The decider sets the deadline and may tighten the wording.
/// </summary>
/// <remarks>Null <c>Title</c> and <c>Description</c> keep what the mentor wrote.</remarks>
public sealed record ApproveProposalRequest(
    DateTimeOffset DueAt,
    string? Title,
    string? Description,
    string? Comment,
    string ConcurrencyToken);

public sealed record RejectProposalRequest(string Comment, string ConcurrencyToken);
