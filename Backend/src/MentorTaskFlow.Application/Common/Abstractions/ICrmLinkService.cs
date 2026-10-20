using MentorTaskFlow.Contracts.Integrations;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// Who in Omuz CRM is who in Mentora: CRM mentor ↔ Mentora account, CRM branch ↔ Mentora branch.
/// </summary>
/// <remarks>
/// The links decide which CRM groups a person sees, so only the Organization Admin sets them. Matches
/// are suggested — by name for now — and never applied without the admin choosing them.
/// </remarks>
public interface ICrmLinkService
{
    Task<CrmLinksDto> GetLinksAsync(CancellationToken cancellationToken);

    Task LinkMentorAsync(int crmMentorId, Guid? userId, CancellationToken cancellationToken);

    Task LinkBranchAsync(int crmBranchId, Guid? branchId, CancellationToken cancellationToken);
}
