using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.Domain.Access;

/// <summary>Who a permission can apply to. An Organization Admin is deliberately not here.</summary>
/// <remarks>
/// The Organization Admin is the root of the permission model: they are never restricted, so a
/// configuration mistake can always be undone and an organization can never lock itself out.
/// </remarks>
public enum PermissionSubject
{
    BranchAdmin = 0,
    Lead = 1,
    Mentor = 2,
}

/// <summary>One switch of the catalog, with the value it has until somebody changes it.</summary>
public sealed record PermissionDefinition(
    string Key,
    string Group,
    IReadOnlyDictionary<PermissionSubject, bool> Defaults)
{
    public bool AppliesTo(PermissionSubject subject) => Defaults.ContainsKey(subject);
}

/// <summary>
/// The closed catalog of what an administrator can allow or refuse.
/// </summary>
/// <remarks>
/// <para>
/// A permission narrows what a role may do; it never widens it. The policy of <c>MtfPolicies</c> and
/// the object checks of each service still decide everything else, so switching a permission on can
/// never reach another branch or category (<c>TEN-011</c> stands: there are still exactly three roles).
/// </para>
/// <para>
/// Every key guards at least one endpoint, which <c>PermissionCatalogTests</c> enforces: a switch that
/// does nothing would tell an administrator that something is restricted when it is not.
/// </para>
/// </remarks>
public static class Permissions
{
    public const string AssignmentsAssign = "assignments.assign";
    public const string AssignmentsReassign = "assignments.reassign";
    public const string AssignmentsReschedule = "assignments.reschedule";
    public const string AssignmentsCancel = "assignments.cancel";
    public const string AssignmentsReview = "assignments.review";
    public const string ProposalsCreate = "proposals.create";
    public const string ProposalsDecide = "proposals.decide";
    public const string ScheduleManage = "schedule.manage";
    public const string UsersManage = "users.manage";
    public const string CategoriesManage = "categories.manage";
    public const string ReportsView = "reports.view";
    public const string AuditView = "audit.view";
    public const string CrmUse = "crm.use";
    public const string PermissionsManage = "permissions.manage";

    private const string AssignmentsGroup = "assignments";
    private const string ProposalsGroup = "proposals";
    private const string TeamGroup = "team";
    private const string DataGroup = "data";

    public static readonly IReadOnlyList<PermissionDefinition> All =
    [
        Define(AssignmentsAssign, AssignmentsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(AssignmentsReassign, AssignmentsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(AssignmentsReschedule, AssignmentsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(AssignmentsCancel, AssignmentsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(AssignmentsReview, AssignmentsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(ScheduleManage, AssignmentsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(ProposalsCreate, ProposalsGroup, PermissionSubject.Mentor),
        Define(ProposalsDecide, ProposalsGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(UsersManage, TeamGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead),
        Define(CategoriesManage, TeamGroup, PermissionSubject.BranchAdmin),
        Define(PermissionsManage, TeamGroup, PermissionSubject.BranchAdmin),
        Define(ReportsView, DataGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead, PermissionSubject.Mentor),
        Define(AuditView, DataGroup, PermissionSubject.BranchAdmin),
        Define(CrmUse, DataGroup, PermissionSubject.BranchAdmin, PermissionSubject.Lead, PermissionSubject.Mentor),
    ];

    private static readonly IReadOnlyDictionary<string, PermissionDefinition> ByKey =
        All.ToDictionary(p => p.Key, StringComparer.Ordinal);

    public static PermissionDefinition? Find(string key) => ByKey.GetValueOrDefault(key);

    /// <summary>Null for an Organization Admin, who is outside the model on purpose.</summary>
    public static PermissionSubject? SubjectOf(UserRole role, AdminScope? adminScope) => role switch
    {
        UserRole.Lead => PermissionSubject.Lead,
        UserRole.Mentor => PermissionSubject.Mentor,
        UserRole.Admin when adminScope is AdminScope.Branch => PermissionSubject.BranchAdmin,
        _ => null,
    };

    /// <summary>
    /// The decision for one person: their personal exception, then the organization's rule for the
    /// role, then the catalog default.
    /// </summary>
    /// <remarks>
    /// A subject the permission does not apply to is refused rather than defaulted. The catalog lists
    /// every role that can reach a guarded endpoint, so landing here means the catalog is out of step
    /// with an endpoint, and that has to fail closed.
    /// </remarks>
    public static bool Resolve(
        PermissionDefinition definition,
        PermissionSubject subject,
        bool? roleRule,
        bool? userOverride)
    {
        ArgumentNullException.ThrowIfNull(definition);

        return definition.Defaults.TryGetValue(subject, out var catalogDefault)
            && (userOverride ?? roleRule ?? catalogDefault);
    }

    private static PermissionDefinition Define(string key, string group, params PermissionSubject[] subjects) =>
        new(key, group, subjects.ToDictionary(s => s, _ => true));
}
