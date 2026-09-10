using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;

namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// MinIO / S3 implementation of <see cref="IFileStorage"/>.
/// </summary>
/// <remarks>
/// Two clients are injected: the default one talks to MinIO over the compose network, and the keyed
/// <c>Presign</c> one signs URLs against <see cref="StorageOptions.PublicEndpoint"/> so the browser
/// can follow them. A deployment behind a single public domain never sets PublicEndpoint, so both
/// resolve to the same client and no code path diverges.
/// </remarks>
internal sealed class MinioFileStorage(
    IMinioClient client,
    [FromKeyedServices(MinioClientKeys.Presign)] IMinioClient presignClient,
    IOptions<StorageOptions> options,
    ILogger<MinioFileStorage> logger) : IFileStorage
{
    private readonly StorageOptions _options = options.Value;

    public async Task PutAsync(string key, Stream content, string contentType, CancellationToken cancellationToken)
    {
        await EnsureBucketAsync(cancellationToken);

        var args = new PutObjectArgs()
            .WithBucket(_options.Bucket)
            .WithObject(key)
            .WithStreamData(content)
            .WithObjectSize(content.Length)
            .WithContentType(contentType);

        await client.PutObjectAsync(args, cancellationToken);
    }

    public async Task<Uri> GetDownloadUrlAsync(
        string key, string contentType, string downloadFileName, CancellationToken cancellationToken)
    {
        // Content-Disposition: attachment forces a save dialog. The filename is sanitised to prevent
        // header injection (SEC-017).
        var safeName = SanitiseHeaderValue(downloadFileName);

        var headers = new Dictionary<string, string>
        {
            ["response-content-type"] = contentType,
            ["response-content-disposition"] = $"attachment; filename=\"{safeName}\"",
        };

        var args = new PresignedGetObjectArgs()
            .WithBucket(_options.Bucket)
            .WithObject(key)
            .WithExpiry(_options.PresignedUrlMinutes * 60)
            .WithHeaders(headers);

        var url = await presignClient.PresignedGetObjectAsync(args);

        return new Uri(url);
    }

    public async Task<Uri> GetPreviewUrlAsync(string key, string contentType, CancellationToken cancellationToken)
    {
        var headers = new Dictionary<string, string>
        {
            ["response-content-type"] = contentType,
            ["response-content-disposition"] = "inline",
        };

        var args = new PresignedGetObjectArgs()
            .WithBucket(_options.Bucket)
            .WithObject(key)
            .WithExpiry(_options.PresignedUrlMinutes * 60)
            .WithHeaders(headers);

        var url = await presignClient.PresignedGetObjectAsync(args);

        return new Uri(url);
    }

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken)
    {
        try
        {
            var args = new BucketExistsArgs().WithBucket(_options.Bucket);
            await client.BucketExistsAsync(args, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Storage readiness check failed for bucket {Bucket}", _options.Bucket);
            return false;
        }
    }

    private async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        if (!_options.EnsureBucketOnStartup) return;

        var exists = await client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_options.Bucket), cancellationToken);

        if (!exists)
        {
            await client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_options.Bucket), cancellationToken);
        }
    }

    /// <summary>Strips characters that could break a Content-Disposition header value.</summary>
    private static string SanitiseHeaderValue(string value)
    {
        var cleaned = new string(value
            .Where(c => !char.IsControl(c) && c is not ('"' or '\\' or '\r' or '\n'))
            .ToArray())
            .Trim();

        return cleaned.Length > 0 ? cleaned : "download";
    }
}
