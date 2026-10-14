namespace MentorTaskFlow.Contracts.Auth;

/// <summary><c>PATCH /auth/me</c> — what a person may change about themselves.</summary>
public sealed record UpdateProfileRequest(string FullName);

/// <summary>One topic's switches: email and Telegram.</summary>
public sealed record ChannelSwitchesDto(bool Email, bool Telegram);

/// <summary>
/// <c>GET/PUT /auth/me/notification-preferences</c>. Invitations and password links are not
/// listed: they are always delivered.
/// </summary>
public sealed record NotificationPreferencesDto(
    ChannelSwitchesDto Assignments,
    ChannelSwitchesDto Deadlines,
    ChannelSwitchesDto Reviews,
    ChannelSwitchesDto System);

/// <summary><c>GET /auth/sessions</c> — how many other devices are signed in right now.</summary>
public sealed record SessionsSummaryDto(int OtherActiveSessions, DateTimeOffset? LastLoginAt);

/// <summary><c>POST /auth/sessions/revoke-others</c>.</summary>
public sealed record RevokeOtherSessionsResponse(int Revoked);
