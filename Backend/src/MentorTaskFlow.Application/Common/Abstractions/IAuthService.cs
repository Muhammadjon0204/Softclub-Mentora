using MentorTaskFlow.Contracts.Auth;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// A freshly issued token pair.
/// </summary>
/// <remarks>
/// The refresh token is returned in plain form exactly once, so the API layer can put it in the
/// <c>mtf_rt</c> cookie. It is never persisted in plain form and never appears in a response body
/// (<c>AUTH-006</c>, <c>AUTH-010</c>).
/// </remarks>
public sealed record AuthenticationResult(LoginResponse Response, string RefreshToken, DateTimeOffset RefreshTokenExpiresAt);

/// <summary>
/// Authentication and password lifecycle (TZ 16).
/// </summary>
/// <remarks>
/// Declared in Application and implemented in Infrastructure, so no handler reaches the
/// <c>DbContext</c> directly (<c>SEC-031</c>, enforced by <c>TenantScopeTests</c>).
/// </remarks>
public interface IAuthService
{
    /// <summary>
    /// Signs a user in.
    /// </summary>
    /// <remarks>
    /// Wrong password, an account with no password set yet, and an account under lockout all answer
    /// 401 <c>INVALID_CREDENTIALS</c> with the same body. Distinguishing them would turn the endpoint
    /// into an account-enumeration oracle (<c>AUTH-024</c>, <c>USER-021</c>).
    /// </remarks>
    Task<AuthenticationResult> LoginAsync(LoginRequest request, string? ipAddress, CancellationToken cancellationToken);

    /// <summary>
    /// Rotates the refresh token (<c>AUTH-007</c>).
    /// </summary>
    /// <remarks>
    /// Presenting an already-revoked token means the value leaked: the whole family is revoked,
    /// <c>TokenVersion</c> is incremented and the answer is 401
    /// <c>REFRESH_TOKEN_REUSE_DETECTED</c> (<c>AUTH-008</c>).
    /// </remarks>
    Task<AuthenticationResult> RefreshAsync(string refreshToken, string? ipAddress, CancellationToken cancellationToken);

    Task LogoutAsync(string refreshToken, string? ipAddress, CancellationToken cancellationToken);

    /// <summary>The authoritative profile — same shape as the login response (<c>AUTH-037</c>).</summary>
    Task<AuthUserDto> GetProfileAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Renames the signed-in person (<c>PATCH /auth/me</c>).</summary>
    Task<AuthUserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken);

    Task<NotificationPreferencesDto> GetNotificationPreferencesAsync(Guid userId, CancellationToken cancellationToken);

    Task<NotificationPreferencesDto> UpdateNotificationPreferencesAsync(
        Guid userId,
        NotificationPreferencesDto request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Other signed-in devices: active refresh-token families other than the one behind
    /// <paramref name="currentRefreshToken"/>.
    /// </summary>
    Task<SessionsSummaryDto> GetSessionsAsync(Guid userId, string? currentRefreshToken, CancellationToken cancellationToken);

    /// <summary>Signs every other device out, keeping the session the request came from.</summary>
    Task<RevokeOtherSessionsResponse> RevokeOtherSessionsAsync(
        Guid userId,
        string? currentRefreshToken,
        string? ipAddress,
        CancellationToken cancellationToken);

    /// <summary>
    /// Changes one's own password.
    /// </summary>
    /// <remarks>
    /// Every other session is revoked, but the caller gets a fresh pair in the response, so the act of
    /// securing the account does not sign the person out of the tab they are using (<c>AUTH-014</c>).
    /// </remarks>
    Task<AuthenticationResult> ChangePasswordAsync(
        Guid userId,
        ChangePasswordRequest request,
        string? ipAddress,
        CancellationToken cancellationToken);

    /// <summary>
    /// Starts a password reset. Completes silently for an unknown address (<c>AUTH-015</c>).
    /// </summary>
    /// <remarks>Queues the link for delivery by email or Telegram; it is never returned to the caller.</remarks>
    Task ForgotPasswordAsync(ForgotPasswordRequest request, string? ipAddress, CancellationToken cancellationToken);

    /// <returns>The account's email, for pre-filling the sign-in form.</returns>
    Task<string> ResetPasswordAsync(ResetPasswordRequest request, string? ipAddress, CancellationToken cancellationToken);

    /// <summary>Sets the first password through the invitation flow (<c>AUTH-020</c>).</summary>
    /// <returns>The account's email, for pre-filling the sign-in form.</returns>
    Task<string> SetPasswordAsync(SetPasswordRequest request, string? ipAddress, CancellationToken cancellationToken);
}
