using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Telegram;

/// <summary>
/// The few Bot API calls that set the bot up and receive updates.
/// </summary>
/// <remarks>
/// Delivery of notifications stays in <see cref="TelegramNotificationSender"/>, which classifies
/// failures for the outbox. This class is for the bot's own plumbing, where a failure is logged and
/// retried by the caller.
/// </remarks>
public sealed class TelegramBotApi(IHttpClientFactory httpClientFactory, IOptions<TelegramOptions> options)
{
    /// <summary>A separate client: <c>getUpdates</c> holds the connection open for up to 50 s.</summary>
    public const string LongPollClientName = "telegram-updates";

    private readonly TelegramOptions _options = options.Value;

    /// <summary><c>getMe</c> — the username the token really belongs to.</summary>
    public async Task<string> GetUsernameAsync(CancellationToken cancellationToken)
    {
        var result = await CallAsync(TelegramNotificationSender.HttpClientName, "getMe", new { }, cancellationToken);

        return result["username"]?.GetValue<string>()
            ?? throw new TelegramApiException(0, "getMe не вернул username.");
    }

    public Task SetWebhookAsync(string url, string secret, CancellationToken cancellationToken) =>
        CallAsync(
            TelegramNotificationSender.HttpClientName,
            "setWebhook",
            new { url, secret_token = secret, allowed_updates = AllowedUpdates, max_connections = 10 },
            cancellationToken);

    /// <summary>Required before polling: Telegram refuses <c>getUpdates</c> while a webhook is set.</summary>
    public Task DeleteWebhookAsync(CancellationToken cancellationToken) =>
        CallAsync(TelegramNotificationSender.HttpClientName, "deleteWebhook", new { drop_pending_updates = false }, cancellationToken);

    /// <summary>The menu shown next to the message box in every chat with the bot.</summary>
    public Task SetCommandsAsync(CancellationToken cancellationToken) =>
        CallAsync(
            TelegramNotificationSender.HttpClientName,
            "setMyCommands",
            new
            {
                commands = new[]
                {
                    new { command = "start", description = "Начать и подключить аккаунт" },
                    new { command = "status", description = "К какому аккаунту подключён этот чат" },
                    new { command = "crm", description = "Связать аккаунт с CRM по номеру телефона" },
                    new { command = "help", description = "Что умеет бот" },
                },
            },
            cancellationToken);

    public async Task<IReadOnlyList<JsonElement>> GetUpdatesAsync(long offset, CancellationToken cancellationToken)
    {
        var result = await CallAsync(
            LongPollClientName,
            "getUpdates",
            new { offset, timeout = _options.PollTimeoutSeconds, allowed_updates = AllowedUpdates },
            cancellationToken);

        return result is JsonArray array
            ? array.Select(node => JsonSerializer.Deserialize<JsonElement>(node!.ToJsonString())).ToList()
            : [];
    }

    public Task SendReplyAsync(TelegramReply reply, CancellationToken cancellationToken) =>
        CallAsync(TelegramNotificationSender.HttpClientName, "sendMessage", reply.ToSendMessage(), cancellationToken);

    private static readonly string[] AllowedUpdates = ["message"];

    private async Task<JsonNode> CallAsync(string clientName, string method, object body, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient(clientName);

        using var response = await client.PostAsJsonAsync($"/bot{_options.BotToken}/{method}", body, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);

        JsonNode? root;

        try
        {
            root = JsonNode.Parse(payload);
        }
        catch (JsonException)
        {
            // Not Telegram's answer — a proxy page or an outage. The token is in the URL, never here.
            throw new TelegramApiException((int)response.StatusCode, $"{method}: ответ не в формате Bot API.");
        }

        if (root?["ok"]?.GetValue<bool>() is not true)
        {
            var code = root?["error_code"]?.GetValue<int>() ?? (int)response.StatusCode;
            var description = root?["description"]?.GetValue<string>() ?? response.ReasonPhrase ?? "ошибка";

            throw new TelegramApiException(code, $"{method}: {description}");
        }

        return root["result"] ?? new JsonObject();
    }
}

public sealed class TelegramApiException(int errorCode, string message) : Exception(message)
{
    public int ErrorCode { get; } = errorCode;
}

/// <summary>
/// What the bot answers in a chat: HTML text and, optionally, one link button.
/// </summary>
/// <remarks>
/// The same object is returned inline from the webhook and sent with <c>sendMessage</c> when polling,
/// so both paths answer identically.
/// </remarks>
public sealed record TelegramReply(
    string ChatId,
    string Html,
    string? ButtonLabel = null,
    string? ButtonUrl = null,
    TelegramKeyboard Keyboard = TelegramKeyboard.None)
{
    public const string SharePhoneLabel = "📱 Поделиться номером";

    public object ToSendMessage() => Keyboard switch
    {
        // A reply keyboard: the button sends the person's own number, confirmed by Telegram.
        TelegramKeyboard.RequestContact => new
        {
            chat_id = ChatId,
            text = Html,
            parse_mode = "HTML",
            disable_web_page_preview = true,
            reply_markup = new
            {
                keyboard = new[] { new[] { new { text = SharePhoneLabel, request_contact = true } } },
                resize_keyboard = true,
                one_time_keyboard = true,
            },
        },
        TelegramKeyboard.Remove => new
        {
            chat_id = ChatId,
            text = Html,
            parse_mode = "HTML",
            disable_web_page_preview = true,
            reply_markup = new { remove_keyboard = true },
        },
        _ when ButtonUrl is null || ButtonLabel is null => new { chat_id = ChatId, text = Html, parse_mode = "HTML", disable_web_page_preview = true },
        _ => new
        {
            chat_id = ChatId,
            text = Html,
            parse_mode = "HTML",
            disable_web_page_preview = true,
            reply_markup = new { inline_keyboard = new[] { new[] { new { text = ButtonLabel, url = ButtonUrl } } } },
        },
    };

    /// <summary>The webhook form: Telegram executes the method named in the response body.</summary>
    public JsonObject ToWebhookResponse()
    {
        var node = JsonSerializer.SerializeToNode(ToSendMessage())!.AsObject();
        node["method"] = "sendMessage";
        return node;
    }
}

/// <summary>
/// The keyboard under a reply. One message carries one kind: a link button, the «share my number»
/// button, or an instruction to take that button away once it has done its job.
/// </summary>
public enum TelegramKeyboard
{
    None,
    RequestContact,
    Remove,
}

/// <summary>
/// The bot's real username, learned from <c>getMe</c> at startup.
/// </summary>
/// <remarks>
/// Deep links are built from it in preference to <see cref="TelegramOptions.BotUsername"/>: a stale
/// setting would otherwise send every person to someone else's bot, where <c>/start</c> binds nothing.
/// </remarks>
public sealed class TelegramBotIdentity
{
    private volatile string? _username;

    public string? Username => _username;

    public void Set(string username) => _username = username;
}
