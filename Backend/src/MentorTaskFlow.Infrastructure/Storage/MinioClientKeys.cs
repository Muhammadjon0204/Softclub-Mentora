namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// Keyed-service keys for <see cref="Minio.IMinioClient"/> registrations.
/// </summary>
internal static class MinioClientKeys
{
    /// <summary>
    /// The client that signs presigned URLs against <c>Storage:PublicEndpoint</c>, so the resulting
    /// URL resolves from a browser rather than from the API container's network.
    /// </summary>
    public const string Presign = "minio-presign";
}
