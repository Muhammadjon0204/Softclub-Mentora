using MentorTaskFlow.Contracts.Users;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>Profile photos: upload and removal by their owner, the directory, and serving.</summary>
public interface IAvatarService
{
    /// <summary>
    /// Validates, stores and attaches a new photo to the caller, replacing any previous one.
    /// </summary>
    /// <remarks>
    /// The client crops and re-encodes the picture to a square WebP or JPEG before sending — which
    /// also strips EXIF and GPS data — and the server accepts nothing else: format, size and
    /// dimensions are checked from the bytes themselves.
    /// </remarks>
    Task UploadAsync(Guid userId, Stream content, long? declaredLength, CancellationToken cancellationToken);

    Task RemoveAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Everyone in the caller's organization who has a photo.</summary>
    Task<IReadOnlyList<UserAvatarDto>> ListAsync(Guid organizationId, CancellationToken cancellationToken);

    /// <summary>The photo's bytes, or null when no such photo exists (removed, replaced, never was).</summary>
    Task<AvatarContent?> OpenAsync(string fileName, CancellationToken cancellationToken);
}

/// <summary>A stored photo, small enough to be held in memory whole.</summary>
public sealed record AvatarContent(byte[] Bytes, string ContentType);
