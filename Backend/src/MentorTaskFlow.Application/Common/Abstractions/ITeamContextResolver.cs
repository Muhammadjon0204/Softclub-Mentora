using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>Who a person is while acting in one of their teams.</summary>
public sealed record TeamSeat(UserRole Role, Guid BranchId);

/// <summary>One membership, with the role the person has while acting in that team.</summary>
public sealed record TeamMembershipSeat(Guid TeamId, UserRole Role);

public interface ITeamContextResolver
{
    /// <summary>The teams the person was added to, beyond the main one on their account.</summary>
    Task<IReadOnlyList<TeamMembershipSeat>> ListMembershipsAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken);

    /// <summary>
    /// The person's seat in the team — <see cref="UserRole.Lead"/> if they lead it, otherwise
    /// <see cref="UserRole.Mentor"/> (an executor) — or null when they do not belong to it.
    /// </summary>
    Task<TeamSeat?> ResolveAsync(Guid userId, Guid organizationId, Guid teamId, CancellationToken cancellationToken);
}
