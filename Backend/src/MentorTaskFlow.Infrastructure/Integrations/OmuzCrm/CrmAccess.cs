using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>
/// The part of the CRM one person sees.
/// </summary>
/// <remarks>
/// The CRM key reads every branch, so the CRM itself isolates nothing: this is where Mentora's own
/// roles are laid over it. <c>Missing</c> is set when the link the scope depends on does not exist yet —
/// the person then sees nothing, never everything.
/// </remarks>
public sealed record CrmAccess(string Scope, string? Missing, int? CrmBranchId, IReadOnlySet<int> MentorIds)
{
    public const string Organization = "Organization";
    public const string Branch = "Branch";
    public const string Team = "Team";
    public const string Own = "Own";

    public bool Ready => Missing is null;

    /// <summary>
    /// Whether a group of <paramref name="branchId"/> taught (now or ever) by <paramref name="mentorIds"/>
    /// is visible.
    /// </summary>
    public bool Sees(int branchId, IEnumerable<int> mentorIds) => Ready && Scope switch
    {
        Organization => true,
        Branch => branchId == CrmBranchId,
        _ => mentorIds.Any(MentorIds.Contains),
    };
}

/// <summary>Works out the caller's <see cref="CrmAccess"/> from their role and the CRM links.</summary>
public sealed class CrmAccessResolver(MentorTaskFlowDbContext dbContext, ICurrentUserAccessor currentUser)
{
    /// <summary>
    /// Whether the caller — a mentor or a Lead without a CRM link — can link themselves through the bot,
    /// and whether their Telegram is connected yet.
    /// </summary>
    public async Task<(bool CanSelfLink, bool TelegramBound)> SelfLinkAsync(CancellationToken cancellationToken)
    {
        var actor = currentUser.Current ?? throw new UnauthorizedException();
        if (actor.Role is UserRole.Admin)
        {
            return (false, false);
        }

        var user = await dbContext.Users
            .Where(u => u.Id == actor.UserId)
            .Select(u => new { u.CrmMentorId, Bound = u.TelegramChatId != null })
            .FirstOrDefaultAsync(cancellationToken);

        return (user is { CrmMentorId: null }, user?.Bound == true);
    }

    public async Task<CrmAccess> ResolveAsync(CancellationToken cancellationToken)
    {
        var actor = currentUser.Current ?? throw new UnauthorizedException();

        switch (actor.Role, actor.AdminScope)
        {
            case (UserRole.Admin, AdminScope.Organization):
                return new CrmAccess(CrmAccess.Organization, null, null, new HashSet<int>());

            case (UserRole.Admin, AdminScope.Branch):
            {
                var crmBranchId = await dbContext.Branches
                    .Where(b => b.Id == actor.BranchId)
                    .Select(b => b.CrmBranchId)
                    .FirstOrDefaultAsync(cancellationToken);

                return new CrmAccess(
                    CrmAccess.Branch,
                    crmBranchId is null ? "Ваш филиал ещё не связан с филиалом в CRM — это делает администратор организации." : null,
                    crmBranchId,
                    new HashSet<int>());
            }

            case (UserRole.Lead, _):
            {
                // The Lead's mentors are the mentors of the Lead's category; the Lead may teach a group
                // too, so their own link counts as well.
                var ids = await dbContext.Users
                    .Where(u => u.CategoryId == actor.CategoryId
                                && u.IsActive
                                && u.CrmMentorId != null
                                && (u.Role == UserRole.Mentor || u.Id == actor.UserId))
                    .Select(u => u.CrmMentorId!.Value)
                    .ToListAsync(cancellationToken);

                return new CrmAccess(
                    CrmAccess.Team,
                    ids.Count == 0 ? "Ни один ментор вашей команды ещё не связан с ментором в CRM — это делает администратор организации." : null,
                    null,
                    ids.ToHashSet());
            }

            default:
            {
                var own = await dbContext.Users
                    .Where(u => u.Id == actor.UserId)
                    .Select(u => u.CrmMentorId)
                    .FirstOrDefaultAsync(cancellationToken);

                return new CrmAccess(
                    CrmAccess.Own,
                    own is null ? "Ваш аккаунт ещё не связан с аккаунтом ментора в CRM. Свяжите его сами через Telegram-бота или попросите администратора организации." : null,
                    null,
                    own is { } id ? new HashSet<int> { id } : new HashSet<int>());
            }
        }
    }
}
