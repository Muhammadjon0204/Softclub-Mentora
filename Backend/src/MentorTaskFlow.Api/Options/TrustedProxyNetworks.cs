using System.Net;

namespace MentorTaskFlow.Api.Options;

/// <summary>
/// Turns the CIDR strings of <see cref="ProxyOptions.TrustedNetworks"/> into networks the forwarded
/// headers middleware accepts.
/// </summary>
internal static class TrustedProxyNetworks
{
    /// <summary>
    /// The loopback and the three private ranges — the addresses a container network and a host-local
    /// nginx actually have, and nothing routable from outside.
    /// </summary>
    private static readonly string[] PrivateDefaults =
    [
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "::1/128",
    ];

    /// <summary>
    /// Parses the configured blocks, falling back to <see cref="PrivateDefaults"/> when none are set.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// A block that does not parse. Thrown rather than skipped: a typo would otherwise silently stop
    /// the proxy from being trusted, and the symptom — every visitor sharing one rate-limit budget —
    /// looks nothing like a configuration error (<c>DEPLOY-015</c>).
    /// </exception>
    public static IEnumerable<IPNetwork> Parse(string[] configured)
    {
        var blocks = configured.Length > 0 ? configured : PrivateDefaults;

        foreach (var block in blocks)
        {
            if (!IPNetwork.TryParse(block, out var network))
            {
                throw new InvalidOperationException(
                    $"Proxy:TrustedNetworks contains '{block}', which is not a CIDR block " +
                    "(expected a form such as 172.16.0.0/12, with the host bits zeroed).");
            }

            yield return network;
        }
    }
}
