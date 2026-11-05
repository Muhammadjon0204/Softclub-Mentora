using MentorTaskFlow.Domain.Access;
using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.UnitTests.Access;

/// <summary>The order of a decision: the person's exception, the role's rule, the catalog.</summary>
public sealed class PermissionResolutionTests
{
    private static readonly PermissionDefinition Review = Permissions.Find(Permissions.AssignmentsReview)!;

    [Fact]
    public void With_nothing_configured_the_catalog_default_stands() =>
        Permissions.Resolve(Review, PermissionSubject.Lead, null, null).ShouldBeTrue();

    [Fact]
    public void A_role_rule_overrides_the_default() =>
        Permissions.Resolve(Review, PermissionSubject.Lead, false, null).ShouldBeFalse();

    [Theory]
    [InlineData(false, true, true)]
    [InlineData(true, false, false)]
    public void A_personal_exception_beats_the_role_rule(bool roleRule, bool userOverride, bool expected) =>
        Permissions.Resolve(Review, PermissionSubject.Lead, roleRule, userOverride).ShouldBe(expected);

    /// <summary>The catalog lists who can reach an endpoint, so landing here must fail closed.</summary>
    [Fact]
    public void A_permission_never_applies_to_a_role_it_does_not_name() =>
        Permissions.Resolve(Review, PermissionSubject.Mentor, true, true).ShouldBeFalse();

    /// <summary>The root of the model: nothing can lock an organization out of its own configuration.</summary>
    [Fact]
    public void An_organization_admin_is_outside_the_model() =>
        Permissions.SubjectOf(UserRole.Admin, AdminScope.Organization).ShouldBeNull();

    [Theory]
    [InlineData(UserRole.Admin, AdminScope.Branch, PermissionSubject.BranchAdmin)]
    [InlineData(UserRole.Lead, null, PermissionSubject.Lead)]
    [InlineData(UserRole.Mentor, null, PermissionSubject.Mentor)]
    public void Everyone_else_has_a_subject(UserRole role, AdminScope? scope, PermissionSubject expected) =>
        Permissions.SubjectOf(role, scope).ShouldBe(expected);
}
