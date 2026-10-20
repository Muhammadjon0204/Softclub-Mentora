using MentorTaskFlow.Contracts.Integrations;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// Read-only view of Omuz CRM for the organization administrator: is the integration alive, which
/// groups exist, and what a group's journal scores to.
/// </summary>
/// <remarks>
/// The first stage of the CRM-based group reports: everything is read live and scored on the fly, so
/// what the CRM really returns — and what in it does not fit — is visible before anything is stored.
/// </remarks>
public interface ICrmIntegrationService
{
    Task<CrmStatusDto> GetStatusAsync(CancellationToken cancellationToken);

    /// <summary><paramref name="status"/>: <c>Preparing</c>, <c>Started</c> or <c>Finished</c>.</summary>
    Task<CrmGroupListDto> ListGroupsAsync(string status, CancellationToken cancellationToken);

    Task<CrmGroupPreviewDto> GetGroupPreviewAsync(int groupId, CancellationToken cancellationToken);
}
