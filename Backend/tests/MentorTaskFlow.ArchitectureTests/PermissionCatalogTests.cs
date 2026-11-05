using System.Reflection;
using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Domain.Access;
using Microsoft.AspNetCore.Mvc;

namespace MentorTaskFlow.ArchitectureTests;

/// <summary>
/// A permission an administrator can switch off has to actually switch something off.
/// </summary>
public sealed class PermissionCatalogTests
{
    private static IReadOnlyList<(string Name, string Permission)> Guards()
    {
        var controllers = typeof(Program).Assembly
            .GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

        return controllers
            .SelectMany(controller =>
            {
                var onClass = controller.GetCustomAttributes<RequirePermissionAttribute>()
                    .Select(a => (controller.Name, a.Permission));

                var onActions = controller
                    .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .SelectMany(m => m.GetCustomAttributes<RequirePermissionAttribute>()
                        .Select(a => ($"{controller.Name}.{m.Name}", a.Permission)));

                return onClass.Concat(onActions);
            })
            .ToList();
    }

    /// <summary>
    /// A switch guarding nothing would tell an administrator that something is restricted when it is
    /// not, which is worse than having no switch.
    /// </summary>
    [Fact]
    public void Every_permission_guards_at_least_one_endpoint()
    {
        var guarded = Guards().Select(g => g.Permission).ToHashSet(StringComparer.Ordinal);

        Permissions.All
            .Select(p => p.Key)
            .Where(key => !guarded.Contains(key))
            .ToArray()
            .ShouldBeEmpty();
    }

    /// <summary>A typo in an attribute would refuse everyone but the Organization Admin, silently.</summary>
    [Fact]
    public void Every_guard_names_a_permission_of_the_catalog()
    {
        Guards()
            .Where(g => Permissions.Find(g.Permission) is null)
            .Select(g => $"{g.Name}: {g.Permission}")
            .ToArray()
            .ShouldBeEmpty();
    }

    [Fact]
    public void Keys_are_unique() =>
        Permissions.All.Select(p => p.Key).Distinct(StringComparer.Ordinal).Count().ShouldBe(Permissions.All.Count);

    [Fact]
    public void Every_permission_applies_to_somebody() =>
        Permissions.All.ShouldAllBe(p => p.Defaults.Count > 0);
}
