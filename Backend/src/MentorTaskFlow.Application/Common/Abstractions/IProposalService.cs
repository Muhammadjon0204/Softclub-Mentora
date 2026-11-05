using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Proposals;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// Mentors' own ideas, from the first draft of the text to the assignment they become.
/// </summary>
public interface IProposalService
{
    /// <summary>A Mentor sees their own, a Lead their category's, an administrator their contour's.</summary>
    Task<PagedResult<ProposalDto>> ListAsync(ProposalListQuery query, CancellationToken cancellationToken);

    Task<ProposalDto> GetAsync(Guid proposalId, CancellationToken cancellationToken);

    Task<ProposalDto> CreateAsync(CreateProposalRequest request, CancellationToken cancellationToken);

    Task<ProposalDto> UpdateAsync(Guid proposalId, UpdateProposalRequest request, CancellationToken cancellationToken);

    Task<ProposalDto> WithdrawAsync(Guid proposalId, ProposalActionRequest request, CancellationToken cancellationToken);

    /// <summary>Creates the assignment and closes the proposal in one transaction.</summary>
    Task<ProposalDto> ApproveAsync(Guid proposalId, ApproveProposalRequest request, CancellationToken cancellationToken);

    Task<ProposalDto> RejectAsync(Guid proposalId, RejectProposalRequest request, CancellationToken cancellationToken);
}
