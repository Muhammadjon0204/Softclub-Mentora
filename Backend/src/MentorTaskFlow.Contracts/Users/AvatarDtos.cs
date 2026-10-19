namespace MentorTaskFlow.Contracts.Users;

/// <summary>
/// One entry of <c>GET /users/avatars</c>: who has a photo and where it is.
/// </summary>
/// <remarks>
/// The directory lets any screen that knows a user id show the photo without every DTO in the system
/// growing an avatar field. People without a photo are simply absent — the client falls back to
/// initials.
/// </remarks>
public sealed record UserAvatarDto(Guid UserId, string AvatarUrl);
