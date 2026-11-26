using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.Infrastructure.Assignments;

/// <summary>
/// Which assignments a person may read (TZ 9.1). Shared by the assignment list and the journal, so the
/// journal never shows more — or less — than the person already sees under «Задания».
/// </summary>
internal static class AssignmentVisibility
{
    public static IQueryable<Assignment> Apply(IQueryable<Assignment> source, ICurrentUserContext actor) => actor switch
    {
        // Level 4 of TZ 9.1: a Mentor sees their own tasks, and never the drafts or suggestions of
        // their category — a suggestion is a proposal the Lead has not yet accepted.
        { Role: UserRole.Mentor } => source.Where(a =>
            a.AssignedToId == actor.UserId
            && a.Status != AssignmentStatus.Draft
            && a.Status != AssignmentStatus.Suggested),

        // A Lead can be an executor too, and an administrator's unpublished draft for them is no more
        // theirs to see than a Mentor's is.
        { Role: UserRole.Lead } => source.Where(a =>
            a.CategoryId == actor.CategoryId
            && !(a.AssignedToId == actor.UserId
                && (a.Status == AssignmentStatus.Draft || a.Status == AssignmentStatus.Suggested))),

        { Role: UserRole.Admin, AdminScope: AdminScope.Branch } => source.Where(a => a.BranchId == actor.BranchId),
        _ => source,
    };
}
