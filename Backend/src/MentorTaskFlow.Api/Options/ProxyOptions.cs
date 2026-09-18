namespace MentorTaskFlow.Api.Options;

/// <summary>
/// Which reverse proxies may speak for the client (<c>X-Forwarded-For</c>, <c>X-Forwarded-Proto</c>).
/// </summary>
/// <remarks>
/// <para>
/// Behind a proxy the connection Kestrel sees belongs to the proxy, not to the caller. Two things in
/// this application read the caller's address and are wrong without these headers: the rate limits of
/// <c>SEC-007</c>, which partition by IP — every visitor would share one budget, so a single account
/// being brute-forced would lock everyone out of <c>/auth/login</c> — and the audit trail, which
/// records the address an action came from.
/// </para>
/// <para>
/// The scheme matters as well. TLS is terminated at the proxy, so without <c>X-Forwarded-Proto</c>
/// the request looks like plain HTTP: HSTS is never emitted and the HTTPS redirect logs a warning on
/// every request because it cannot find a port to redirect to.
/// </para>
/// <para>
/// Trusting the headers is only safe from a proxy, since anyone may send them. The default is the
/// loopback and the private ranges — the addresses a container network and a host-local nginx
/// actually have. That default holds as long as the API port stays bound to <c>127.0.0.1</c>, which
/// is how <c>docker-compose.api.yml</c> publishes it; expose it publicly and this must be narrowed to
/// the proxy's own address.
/// </para>
/// </remarks>
public sealed class ProxyOptions
{
    public const string SectionName = "Proxy";

    /// <summary>Turns the forwarded headers off for a deployment reached without a proxy.</summary>
    public bool Enabled { get; init; } = true;

    /// <summary>
    /// How many proxies stand in front. Headers beyond this count are ignored.
    /// </summary>
    /// <remarks>
    /// Two by default: the host nginx, and room for one more layer (a CDN, or the container's own
    /// nginx in a single-origin topology). Raising it lets a caller forge the addresses of the hops
    /// beyond the real ones, which is why it is a small number and not unbounded.
    /// </remarks>
    public int ForwardLimit { get; init; } = 2;

    /// <summary>CIDR blocks of trusted proxies. Empty means the loopback and the private ranges.</summary>
    public string[] TrustedNetworks { get; init; } = [];
}
