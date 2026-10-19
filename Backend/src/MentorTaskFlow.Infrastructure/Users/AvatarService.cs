using System.Security.Cryptography;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Users;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Options;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace MentorTaskFlow.Infrastructure.Users;

/// <inheritdoc />
/// <remarks>
/// <para>
/// Photos live in the submissions bucket under <c>avatars/</c>, a prefix the orphan sweep never lists.
/// They are served by the API itself rather than through presigned links: a presigned URL changes on
/// every request and expires, which would defeat the one thing an avatar needs most — being cached
/// once and shown from the cache everywhere afterwards.
/// </para>
/// <para>
/// Saving the user publishes a realtime <c>user</c> signal through the save pipeline, so every open
/// screen picks the new photo up without a reload.
/// </para>
/// </remarks>
public sealed class AvatarService(
    MentorTaskFlowDbContext dbContext,
    IMinioClient client,
    IOptions<StorageOptions> options,
    IClock clock,
    ILogger<AvatarService> logger) : IAvatarService
{
    public const string UrlPrefix = "/api/v1/avatars/";
    private const string ObjectPrefix = "avatars/";

    private readonly StorageOptions _options = options.Value;

    /// <summary>The public address of a stored photo, or null for none.</summary>
    public static string? UrlFor(string? avatarKey) => avatarKey is null ? null : UrlPrefix + avatarKey;

    public async Task UploadAsync(Guid userId, Stream content, long? declaredLength, CancellationToken cancellationToken)
    {
        if (declaredLength > AvatarImage.MaxBytes)
        {
            throw new PayloadTooLargeException(ErrorCodes.FileTooLarge, "Фотография должна быть не больше 512 КБ.");
        }

        // Read at most one byte past the limit: enough to know it was exceeded, never more.
        var buffer = new byte[AvatarImage.MaxBytes + 1];
        var length = await content.ReadAtLeastAsync(buffer, buffer.Length, throwOnEndOfStream: false, cancellationToken);
        var bytes = buffer.AsMemory(0, length);

        var image = AvatarImage.Inspect(bytes.Span);

        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, cancellationToken)
            ?? throw new UnauthorizedException();

        var key = $"{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16))}.{image.Extension}";

        // Object first, row second: a failure in between leaves an unreferenced object, never a
        // profile pointing at nothing.
        using (var stream = new MemoryStream(bytes.ToArray(), writable: false))
        {
            await client.PutObjectAsync(
                new PutObjectArgs()
                    .WithBucket(_options.Bucket)
                    .WithObject(ObjectPrefix + key)
                    .WithStreamData(stream)
                    .WithObjectSize(stream.Length)
                    .WithContentType(image.ContentType),
                cancellationToken);
        }

        var previous = user.ReplaceAvatar(key, clock.UtcNow);
        await dbContext.SaveChangesAsync(cancellationToken);

        await DeleteQuietlyAsync(previous, cancellationToken);
    }

    public async Task RemoveAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, cancellationToken)
            ?? throw new UnauthorizedException();

        var previous = user.RemoveAvatar(clock.UtcNow);

        if (previous is null)
        {
            return;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await DeleteQuietlyAsync(previous, cancellationToken);
    }

    public async Task<IReadOnlyList<UserAvatarDto>> ListAsync(Guid organizationId, CancellationToken cancellationToken) =>
        await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.OrganizationId == organizationId && u.AvatarKey != null)
            .Select(u => new UserAvatarDto(u.Id, UrlPrefix + u.AvatarKey))
            .ToListAsync(cancellationToken);

    public async Task<AvatarContent?> OpenAsync(string fileName, CancellationToken cancellationToken)
    {
        // The name is checked before it goes anywhere near storage: only server-generated names exist.
        if (!User.IsValidAvatarKey(fileName))
        {
            return null;
        }

        try
        {
            using var copy = new MemoryStream();
            await client.GetObjectAsync(
                new GetObjectArgs()
                    .WithBucket(_options.Bucket)
                    .WithObject(ObjectPrefix + fileName)
                    .WithCallbackStream((stream, ct) => stream.CopyToAsync(copy, ct)),
                cancellationToken);

            return new AvatarContent(copy.ToArray(), fileName.EndsWith(".webp", StringComparison.Ordinal) ? "image/webp" : "image/jpeg");
        }
        catch (Exception exception) when (exception is ObjectNotFoundException or BucketNotFoundException)
        {
            return null;
        }
    }

    /// <summary>
    /// Removes a replaced photo. A failure only leaves an unreferenced object behind — never worth
    /// failing the request the person already saw succeed.
    /// </summary>
    private async Task DeleteQuietlyAsync(string? key, CancellationToken cancellationToken)
    {
        if (key is null)
        {
            return;
        }

        try
        {
            await client.RemoveObjectAsync(
                new RemoveObjectArgs().WithBucket(_options.Bucket).WithObject(ObjectPrefix + key),
                cancellationToken);
        }
#pragma warning disable CA1031 // Best effort by design; see the summary.
        catch (Exception exception)
#pragma warning restore CA1031
        {
            logger.LogWarning(exception, "A replaced profile photo could not be removed from storage.");
        }
    }
}
