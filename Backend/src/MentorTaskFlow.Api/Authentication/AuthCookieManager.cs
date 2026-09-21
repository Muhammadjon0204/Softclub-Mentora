using System.Security.Cryptography;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Api.Authentication;

/// <summary>
/// Writes and clears the two authentication cookies (TZ 16.3).
/// </summary>
/// <remarks>
/// <para>
/// Version 2.0 allowed <c>SameSite=Strict</c> together with cross-site hosting, which are mutually
/// exclusive. One topology is fixed instead: the SPA on <c>app.&lt;domain&gt;</c> and the API on
/// <c>api.&lt;domain&gt;</c>, sharing a registrable domain. Those are same-site, so a
/// <c>SameSite=Strict</c> cookie is still sent on the XHR to <c>/api/v1/auth/refresh</c>
/// (<c>DEPLOY-010</c>, <c>AUTH-010</c>).
/// </para>
/// <para>
/// Neither cookie carries a <c>Domain</c> attribute by default, making both host-only: a sibling
/// subdomain cannot receive them. That is fine for <c>mtf_rt</c> — only the API ever needs it — but
/// it silently breaks the CSRF double-submit on a split <c>app.</c>/<c>api.</c> topology, since
/// script on <c>app.&lt;domain&gt;</c> then can't read a cookie that belongs to
/// <c>api.&lt;domain&gt;</c>. <see cref="AuthOptions.CsrfCookieDomain"/> widens <c>mtf_csrf</c> alone
/// for exactly that case.
/// </para>
/// </remarks>
public sealed class AuthCookieManager(IOptions<AuthOptions> authOptions)
{
    /// <summary>Refresh token. HttpOnly, so page script cannot read it.</summary>
    public const string RefreshTokenCookieName = "mtf_rt";

    /// <summary>CSRF token. Deliberately readable by script — the client must echo it in a header.</summary>
    public const string CsrfCookieName = "mtf_csrf";

    public const string CsrfHeaderName = "X-CSRF-Token";

    /// <summary>
    /// Restricts the HttpOnly refresh cookie to the auth endpoints, so no other request carries it
    /// (<c>AUTH-010</c>, <c>AUTH-011</c>). Only affects which requests the browser attaches the cookie
    /// to — irrelevant to script readability, since it's HttpOnly anyway.
    /// </summary>
    public const string CookiePath = "/api/v1/auth";

    /// <summary>
    /// Scope of the CSRF cookie: the whole origin, deliberately wider than <see cref="CookiePath"/>.
    /// </summary>
    /// <remarks>
    /// A cookie's <c>Path</c> scopes both when the browser sends it AND which documents may read it
    /// via script, using the same prefix match. Scoping this cookie to <see cref="CookiePath"/> made
    /// <c>readCsrfToken()</c> (<c>lib/cookies.ts</c>) return <c>null</c> on every real page the SPA
    /// renders — <c>/login</c>, <c>/dashboard</c> and the rest — so <c>X-CSRF-Token</c> was never
    /// attached and every <c>/auth/refresh</c> call failed <c>CSRF_VALIDATION_FAILED</c>, the root
    /// cause of "refresh logs the user out". Приложение D.1 specifies the two paths separately for
    /// this reason.
    ///
    /// Widening it costs nothing: the value is an opaque random token that only ever proves the
    /// caller could read a cookie from this origin.
    /// </remarks>
    public const string CsrfCookiePath = "/";

    /// <summary>
    /// Issues the refresh cookie and a matching CSRF pair.
    /// </summary>
    /// <remarks>
    /// <paramref name="requireSecure"/> is false only in Development, where the API runs over plain
    /// HTTP; a <c>Secure</c> cookie would simply never be stored and every local login would appear
    /// to fail. Everywhere else HTTPS is mandatory (<c>SEC-008</c>).
    /// </remarks>
    public void IssueAuthCookies(HttpResponse response, string refreshToken, DateTimeOffset expiresAt, bool requireSecure)
    {
        response.Cookies.Append(RefreshTokenCookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = requireSecure,
            SameSite = SameSiteMode.Strict,
            Path = CookiePath,
            Expires = expiresAt,
            IsEssential = true,
        });

        // Double-submit: the value is readable by script precisely so the client can copy it into
        // X-CSRF-Token. Its security comes from the same-origin policy — a cross-site page can cause
        // the cookie to be sent but cannot read it to build the matching header (AUTH-012).
        response.Cookies.Append(CsrfCookieName, GenerateCsrfToken(), new CookieOptions
        {
            HttpOnly = false,
            Secure = requireSecure,
            SameSite = SameSiteMode.Strict,
            Path = CsrfCookiePath,
            Domain = authOptions.Value.CsrfCookieDomain,
            Expires = expiresAt,
            IsEssential = true,
        });
    }

    public void ClearAuthCookies(HttpResponse response, bool requireSecure)
    {
        // Path and SameSite must match the originals exactly, or the browser treats these as different
        // cookies and the old ones survive the logout.
        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = requireSecure,
            SameSite = SameSiteMode.Strict,
            Path = CookiePath,
        };

        response.Cookies.Delete(RefreshTokenCookieName, options);
        response.Cookies.Delete(CsrfCookieName, new CookieOptions
        {
            HttpOnly = false,
            Secure = requireSecure,
            SameSite = SameSiteMode.Strict,
            Path = CsrfCookiePath,
            Domain = authOptions.Value.CsrfCookieDomain,
        });
    }

    private static string GenerateCsrfToken() =>
        System.Buffers.Text.Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
}
