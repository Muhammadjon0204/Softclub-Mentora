using System.ComponentModel.DataAnnotations;

namespace MentorTaskFlow.Infrastructure.Options;

/// <summary>
/// The Telegram bot (TZ 19, Приложение L).
/// </summary>
/// <remarks>
/// <see cref="Enabled"/> is the feature flag of 4.1: with it off the bind endpoints answer 404 —
/// not 403 — because a capability the installation does not have should be indistinguishable from one
/// that does not exist.
/// </remarks>
public sealed class TelegramOptions
{
    public const string SectionName = "Telegram";

    public bool Enabled { get; init; }

    /// <summary>Used to build the deep link; never the token (<c>TG-005</c>).</summary>
    public string BotUsername { get; init; } = "mentortaskflow_bot";

    /// <summary>From the environment only, like every other secret (<c>SEC-010</c>).</summary>
    public string? BotToken { get; init; }

    /// <summary>
    /// The Bot API host. Only ever changed to point a local or test run at a stand-in, so no real chat
    /// receives test traffic.
    /// </summary>
    [Url]
    public string ApiBaseUrl { get; init; } = "https://api.telegram.org";

    /// <summary>
    /// Compared constant-time against <c>X-Telegram-Bot-Api-Secret-Token</c> (<c>TG-002</c>).
    /// </summary>
    /// <remarks>
    /// The webhook is anonymous to the outside world, so this header is the only thing separating
    /// Telegram from anyone who has guessed the URL.
    /// </remarks>
    public string? WebhookSecret { get; init; }

    /// <summary>
    /// How messages sent to the bot reach this server: <c>Auto</c> (default), <c>Webhook</c>,
    /// <c>Polling</c> or <c>Off</c>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Nothing reaches the server until Telegram is told where to send updates. Without that the bot
    /// opens, <c>/start</c> goes nowhere, the account is never bound and no notification is ever sent —
    /// which is exactly what an installation without this step looks like.
    /// </para>
    /// <para>
    /// <c>Auto</c> registers <see cref="WebhookUrl"/> when it is a public HTTPS address and a valid
    /// <see cref="WebhookSecret"/> is set, and otherwise — or if Telegram refuses the webhook — fetches
    /// updates itself (long polling), which needs no inbound connection at all.
    /// </para>
    /// </remarks>
    [RegularExpression("^(Auto|Webhook|Polling|Off)$", ErrorMessage = "Telegram:UpdatesMode — Auto, Webhook, Polling или Off.")]
    public string UpdatesMode { get; init; } = "Auto";

    /// <summary>
    /// The public HTTPS address of <c>POST /api/v1/telegram/webhook</c>, e.g.
    /// <c>https://tmsapi.softclub.tj/api/v1/telegram/webhook</c>.
    /// </summary>
    public string? WebhookUrl { get; init; }

    /// <summary>
    /// Whether this process sets up the bot and receives updates. False on the worker: exactly one
    /// process may poll, or Telegram answers the second with 409.
    /// </summary>
    public bool ReceiveUpdates { get; init; } = true;

    /// <summary>Long-polling wait per <c>getUpdates</c> call.</summary>
    [Range(1, 50)]
    public int PollTimeoutSeconds { get; init; } = 25;

    /// <summary>Issuing a bind token: 5 per hour per user (<c>TG-014</c>, <c>SEC-007</c>).</summary>
    [Range(1, 100)]
    public int BindTokenRequestsPerHour { get; init; } = 5;

    /// <summary>Redeeming one: 20 attempts per hour per chat (<c>TG-014</c>).</summary>
    [Range(1, 1000)]
    public int BindAttemptsPerHourPerChat { get; init; } = 20;

    /// <summary>Telegram accepts only these characters in a webhook <c>secret_token</c>.</summary>
    public bool HasUsableWebhookSecret =>
        !string.IsNullOrEmpty(WebhookSecret)
        && WebhookSecret.Length <= 256
        && WebhookSecret.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-');

    public bool HasPublicWebhookUrl =>
        Uri.TryCreate(WebhookUrl, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && !uri.IsLoopback;
}
