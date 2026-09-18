using System.ComponentModel.DataAnnotations;

namespace MentorTaskFlow.Infrastructure.Options;

/// <summary>
/// Object storage and the file limits of Приложение L.
/// </summary>
/// <remarks>
/// Every limit here is a defence, not a preference, so each has a default that is safe on its own:
/// a deployment that forgets to set them still refuses a 500 MB upload and still gives up on a zip
/// bomb after five seconds. Credentials have no defaults at all — they come from the environment
/// (<c>SEC-010</c>).
/// </remarks>
public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    [Required]
    public string Endpoint { get; init; } = null!;

    /// <summary>
    /// The endpoint baked into a presigned URL, when it must differ from <see cref="Endpoint"/>.
    /// </summary>
    /// <remarks>
    /// Only needed where the API and the browser reach storage through different names for the same
    /// service — the Development compose network, where the API must dial the compose service name
    /// (<c>minio</c>) while a presigned URL is followed by the developer's own browser, which cannot
    /// resolve that name at all. A real deployment behind one public domain leaves this unset and both
    /// roles share <see cref="Endpoint"/>. Rewriting the host in an already-signed URL is not an option:
    /// the host is part of what MinIO signs, so a URL built for one endpoint fails verification at the
    /// other (<c>SEC-020</c>).
    /// </remarks>
    public string? PublicEndpoint { get; init; }

    [Required]
    public string AccessKey { get; init; } = null!;

    [Required]
    public string SecretKey { get; init; } = null!;

    /// <summary>
    /// One bucket for the whole installation (<c>TEN-066</c>). A bucket per branch would turn creating
    /// a branch — a product operation — into an infrastructure one, since MinIO policies would have to
    /// be managed on every creation. Isolation comes from the permission check that precedes a URL and
    /// from the scope prefix in the key, not from separate buckets.
    /// </summary>
    [Required]
    public string Bucket { get; init; } = "mentortaskflow";

    /// <summary>
    /// Whether the endpoint is reached over TLS.
    /// </summary>
    /// <remarks>
    /// Authoritative over any scheme written into <see cref="Endpoint"/>: the client is given a host
    /// and a port, and the scheme comes from here. Path-style addressing has no setting because the
    /// MinIO client does nothing else — virtual-host style would need DNS per bucket.
    /// </remarks>
    public bool UseSsl { get; init; }

    /// <summary>
    /// Scheme of the presigned URL, when it differs from <see cref="UseSsl"/>. Falls back to it.
    /// </summary>
    /// <remarks>
    /// Needed wherever <see cref="PublicEndpoint"/> is: the two addresses can differ in scheme as
    /// easily as in host. A deployment that terminates TLS at a reverse proxy reaches MinIO over
    /// plain HTTP on the container network while the browser must be sent an <c>https</c> link —
    /// one flag for both would either break the internal connection or emit a link the page cannot
    /// follow, since a page served over HTTPS may not load an HTTP resource.
    /// </remarks>
    public bool? PublicUseSsl { get; init; }

    /// <summary>Creates the bucket at startup when missing. Development and Test only.</summary>
    public bool EnsureBucketOnStartup { get; init; }

    [Range(1, 60)]
    public int PresignedUrlMinutes { get; init; } = 10;

    [Range(1024, 1_073_741_824)]
    public long MaxFileBytes { get; init; } = 52_428_800;

    [Range(1, 100_000)]
    public int ZipMaxEntries { get; init; } = 2_000;

    [Range(1024, 10_737_418_240)]
    public long ZipMaxUncompressedBytes { get; init; } = 314_572_800;

    [Range(1, 10_000)]
    public int ZipMaxRatio { get; init; } = 100;

    [Range(1, 120)]
    public int ZipValidationTimeoutSeconds { get; init; } = 5;

    [Range(1, 8_760)]
    public int OrphanTtlHours { get; init; } = 24;
}
