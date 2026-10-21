namespace MentorTaskFlow.Contracts.Integrations;

/// <summary>
/// <c>GET /integrations/crm/access</c> — what the caller sees of the CRM and why.
/// </summary>
/// <remarks>
/// <c>Scope</c>: <c>Organization</c> (everything), <c>Branch</c> (the CRM branch linked to the caller's
/// branch), <c>Team</c> (the groups of the Lead's mentors and the Lead's own), <c>Own</c> (the mentor's
/// own groups). <c>Ready</c> is false while the link it needs is missing — <c>Message</c> says which.
/// <c>CanSelfLink</c>: a mentor or Lead not linked yet, who can link themselves by sharing their phone
/// in the bot (<c>BotUrl</c>) — once <c>TelegramBound</c>, the chat is connected to this account.
/// </remarks>
public sealed record CrmAccessDto(
    string Scope,
    bool Ready,
    string? Message,
    int LinkedMentors,
    bool CanSelfLink = false,
    bool TelegramBound = false,
    string? BotUrl = null);

/// <summary>A CRM mentor and the Mentora account linked to it, or the one that looks like it.</summary>
public sealed record CrmMentorLinkDto(
    int CrmMentorId,
    string FullName,
    string? Phone,
    string? Branch,
    bool IsActive,
    int CurrentGroups,
    Guid? LinkedUserId,
    string? LinkedUserName,
    Guid? SuggestedUserId,
    string? SuggestedUserName);

/// <summary>A CRM branch and the Mentora branch linked to it, or the one that looks like it.</summary>
public sealed record CrmBranchLinkDto(
    int CrmBranchId,
    string Name,
    Guid? LinkedBranchId,
    string? LinkedBranchName,
    Guid? SuggestedBranchId);

/// <summary>A Mentora account that can be linked to a CRM mentor: a Mentor or a Lead.</summary>
public sealed record CrmLinkableUserDto(Guid Id, string FullName, string Role, string? Branch, int? CrmMentorId);

public sealed record CrmLinkableBranchDto(Guid Id, string Name, int? CrmBranchId);

/// <summary><c>GET /integrations/crm/links</c> — everything the linking screen needs in one read.</summary>
public sealed record CrmLinksDto(
    IReadOnlyList<CrmMentorLinkDto> Mentors,
    IReadOnlyList<CrmBranchLinkDto> Branches,
    IReadOnlyList<CrmLinkableUserDto> Users,
    IReadOnlyList<CrmLinkableBranchDto> MentoraBranches);

/// <summary><c>PUT /integrations/crm/links/mentors/{crmMentorId}</c>. <c>UserId</c> null unlinks.</summary>
public sealed record CrmLinkMentorRequest(Guid? UserId);

/// <summary><c>PUT /integrations/crm/links/branches/{crmBranchId}</c>. <c>BranchId</c> null unlinks.</summary>
public sealed record CrmLinkBranchRequest(Guid? BranchId);
