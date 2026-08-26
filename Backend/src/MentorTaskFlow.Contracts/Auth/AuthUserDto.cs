using MentorTaskFlow.Contracts.Categories;
using MentorTaskFlow.Contracts.Tenancy;

namespace MentorTaskFlow.Contracts.Auth;

/// <summary>
/// The single authoritative profile shape, returned identically by <c>POST /auth/login</c> and
/// <c>GET /auth/me</c> (<c>AUTH-037</c>).
/// </summary>
/// <remarks>
/// <para>
/// The frontend is not a trusted source of the profile: whatever it decodes from the JWT is a UX hint
/// until this response arrives, and the backend never accepts scope handed back by a client
/// (<c>AUTH-036</c>, <c>SEC-003</c>).
/// </para>
/// <para>
/// Field population is fully determined by the user type (<c>AUTH-038</c>): an Organization Admin has
/// <c>branch = null</c> and <c>category = null</c>; a Branch Admin has a branch and no category;
/// Lead and Mentor have both. <c>organization</c> is always present.
/// </para>
/// <para>
/// <c>category</c> carries its name and zone the same way <c>branch</c> does, rather than a bare id: a
/// Lead/Mentor page needs both on first render (sidebar label, deadline formatting), and a page that
/// resolved them from anywhere other than this one profile call would be a second source of truth for
/// exactly the fact <c>FE-034</c> already centralises for Branch (<c>AUTH-038</c>).
/// </para>
/// </remarks>
public sealed record AuthUserDto(
    Guid Id,
    string FullName,
    string Email,
    string Role,
    string? AdminScope,
    OrganizationSummaryDto Organization,
    BranchSummaryDto? Branch,
    CategorySummaryDto? Category);

/// <summary>Response of <c>POST /auth/login</c> — the profile plus the access token (<c>AUTH-039</c>).</summary>
/// <remarks>
/// The refresh token is <b>not</b> here: it travels only in the <c>mtf_rt</c> cookie, which is
/// HttpOnly so that script running on the page cannot read it (<c>AUTH-010</c>).
/// </remarks>
public sealed record LoginResponse(
    AuthUserDto User,
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    bool? TelegramBound);
