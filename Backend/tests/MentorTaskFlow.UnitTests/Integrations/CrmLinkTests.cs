using MentorTaskFlow.Domain.Common;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

namespace MentorTaskFlow.UnitTests.Integrations;

/// <summary>Who sees which CRM groups, and how a CRM mentor is matched to a RAVAND account.</summary>
public sealed class CrmLinkTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void A_cyrillic_name_matches_the_crm_latin_one()
    {
        var crm = CrmLinkService.NameKey("Hakim Jumaev");

        crm.IsSubsetOf(CrmLinkService.NameKey("Джумаев Хаким Рахимович")).ShouldBeTrue();
        crm.IsSubsetOf(CrmLinkService.NameKey("Jumaev  Hakim")).ShouldBeTrue();
        crm.IsSubsetOf(CrmLinkService.NameKey("Джумаев Карим")).ShouldBeFalse();
    }

    [Theory]
    [InlineData("939123497", "93•••••97")]
    [InlineData("+992 93 912 34 97", "99••••••••97")]
    [InlineData("123", null)]
    [InlineData(null, null)]
    public void A_phone_is_masked(string? phone, string? masked) => CrmLinkService.MaskPhone(phone).ShouldBe(masked);

    [Fact]
    public void A_mentor_sees_only_groups_they_taught()
    {
        var access = new CrmAccess(CrmAccess.Own, null, null, new HashSet<int> { 7 });

        access.Sees(1, [7, 48]).ShouldBeTrue();
        access.Sees(1, [48]).ShouldBeFalse();
    }

    [Fact]
    public void A_branch_admin_sees_only_the_linked_crm_branch()
    {
        var access = new CrmAccess(CrmAccess.Branch, null, 9, new HashSet<int>());

        access.Sees(9, []).ShouldBeTrue();
        access.Sees(1, [7]).ShouldBeFalse();
    }

    /// <summary>Without the link the scope needs, nothing is visible — never everything.</summary>
    [Fact]
    public void A_missing_link_shows_nothing()
    {
        var access = new CrmAccess(CrmAccess.Branch, "не связан", null, new HashSet<int>());

        access.Ready.ShouldBeFalse();
        access.Sees(1, []).ShouldBeFalse();
    }

    [Fact]
    public void An_organization_admin_sees_every_group()
    {
        new CrmAccess(CrmAccess.Organization, null, null, new HashSet<int>()).Sees(5, []).ShouldBeTrue();
    }

    [Fact]
    public void A_mentor_account_is_linked_and_unlinked()
    {
        var user = User.CreateMentor(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Хаким Джумаев", "h@example.com", Now);

        user.LinkCrmMentor(48, Now);
        user.CrmMentorId.ShouldBe(48);

        user.LinkCrmMentor(null, Now);
        user.CrmMentorId.ShouldBeNull();
    }

    [Fact]
    public void An_admin_is_never_a_crm_mentor()
    {
        var admin = User.CreateOrganizationAdmin(Guid.NewGuid(), "Админ", "a@example.com", Now);

        Should.Throw<DomainException>(() => admin.LinkCrmMentor(48, Now));
    }
}
