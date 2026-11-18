namespace MentorTaskFlow.Contracts.Auth;

/// <summary>
/// Sign-in of the native mobile app. Unlike the web flow, the refresh token travels in the body: a
/// native app has no HttpOnly cookie jar to hide it in, so it keeps the token in the platform's secure
/// store (Keychain / Keystore) instead. Rotation, reuse detection and revocation are the same as for
/// the web — only the transport differs.
/// </summary>
public sealed record MobileLoginResponse(
    AuthUserDto User,
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    bool? TelegramBound,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);

/// <summary>Body of <c>POST /auth/mobile/refresh</c> and <c>POST /auth/mobile/logout</c>.</summary>
public sealed record MobileRefreshRequest(string RefreshToken);
