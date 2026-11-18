using MentorTaskFlow.Api.Authentication;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Contracts.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Sign-in for the native mobile app (<c>Mobile/</c>): the same accounts and the same token rotation
/// as <see cref="AuthController"/>, with the refresh token in the body instead of a cookie.
/// </summary>
/// <remarks>
/// <para>
/// No CSRF guard here, on purpose: CSRF exists because a browser attaches cookies to a request a
/// foreign page started. These endpoints set and read no cookies, so a forged request has no
/// credential to ride on — it would have to know the refresh token itself.
/// </para>
/// <para>
/// The web flow keeps its HttpOnly cookie: a token in the body is only acceptable where no page
/// script can read it, which is true of a native app's secure store and false of a browser tab.
/// </para>
/// </remarks>
[ApiController]
[Route("api/v1/auth/mobile")]
[Produces("application/json")]
public sealed class MobileAuthController(IAuthService authService) : ControllerBase
{
    /// <summary><c>POST /auth/mobile/login</c> — same rate limit as the web login (<c>SEC-007</c>).</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    [ProducesResponseType<MobileLoginResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MobileLoginResponse>> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.LoginAsync(request, RemoteIp, cancellationToken);
        return Issue(result);
    }

    /// <summary>
    /// <c>POST /auth/mobile/refresh</c> — rotates the token. Replaying an old one revokes the whole
    /// family, exactly as on the web (<c>AUTH-008</c>).
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType<MobileLoginResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MobileLoginResponse>> RefreshAsync(MobileRefreshRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.RefreshAsync(request.RefreshToken ?? string.Empty, RemoteIp, cancellationToken);
        return Issue(result);
    }

    /// <summary><c>POST /auth/mobile/logout</c> — revokes the token; the app then forgets it.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> LogoutAsync(MobileRefreshRequest request, CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(request.RefreshToken ?? string.Empty, RemoteIp, cancellationToken);

        NoStore();
        return NoContent();
    }

    private ActionResult<MobileLoginResponse> Issue(AuthenticationResult result)
    {
        var r = result.Response;

        NoStore();
        return Ok(new MobileLoginResponse(
            r.User,
            r.AccessToken,
            r.AccessTokenExpiresAt,
            r.TelegramBound,
            result.RefreshToken,
            result.RefreshTokenExpiresAt));
    }

    private string? RemoteIp => HttpContext.Connection.RemoteIpAddress?.ToString();

    private void NoStore()
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers.Pragma = "no-cache";
    }
}
