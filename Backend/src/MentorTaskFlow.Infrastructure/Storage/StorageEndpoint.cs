namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// Splits a MinIO endpoint string into the host and port that the client constructor expects.
/// </summary>
/// <remarks>
/// The MinIO .NET client takes (host, port) rather than a URI, so every endpoint configured as
/// <c>http://minio:9000</c> or <c>https://storage.example.com</c> must be decomposed. The scheme
/// is intentionally ignored: <see cref="Options.StorageOptions.UseSsl"/> is authoritative.
/// </remarks>
internal sealed record StorageEndpoint(string Host, int Port)
{
    /// <summary>
    /// Parses <c>http(s)://host:port</c> or plain <c>host:port</c>.
    /// </summary>
    public static StorageEndpoint Parse(string endpoint)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(endpoint);

        // If the string starts with a scheme, let Uri do the work.
        if (endpoint.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || endpoint.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(endpoint);
            var port = uri.Port > 0 ? uri.Port : (uri.Scheme == "https" ? 443 : 80);
            return new StorageEndpoint(uri.Host, port);
        }

        // Plain host:port (e.g. "minio:9000").
        var colon = endpoint.LastIndexOf(':');

        if (colon > 0 && int.TryParse(endpoint[(colon + 1)..], out var parsedPort))
        {
            return new StorageEndpoint(endpoint[..colon], parsedPort);
        }

        // Bare hostname — default to 9000 (MinIO's default).
        return new StorageEndpoint(endpoint, 9000);
    }
}
