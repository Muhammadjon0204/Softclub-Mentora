using MentorTaskFlow.Contracts.Categories;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// Who belongs to a team beyond the people whose main team it is.
/// </summary>
/// <remarks>
/// An administrator manages any team of their contour; a Lead manages the team they are acting in,
/// adding mentors and participants only — never an administrator, and never another Lead.
/// </remarks>
public interface ITeamMemberService
{
    Task<IReadOnlyList<TeamMemberDto>> ListAsync(Guid categoryId, CancellationToken cancellationToken);

    /// <summary>People of the team's branch the caller may add, narrowed by name or email.</summary>
    Task<IReadOnlyList<TeamCandidateDto>> ListCandidatesAsync(Guid categoryId, string? search, CancellationToken cancellationToken);

    Task<TeamMemberDto> AddAsync(Guid categoryId, AddTeamMemberRequest request, CancellationToken cancellationToken);

    Task<TeamMemberDto> ChangeRoleAsync(Guid categoryId, Guid userId, ChangeTeamMemberRoleRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Takes the person out of an additional team. Refused while they hold unfinished work in it.
    /// </summary>
    Task RemoveAsync(Guid categoryId, Guid userId, CancellationToken cancellationToken);
}
