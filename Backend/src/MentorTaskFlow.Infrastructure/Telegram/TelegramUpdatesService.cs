using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Telegram;

/// <summary>
/// Makes messages to the bot reach this server, and keeps them coming.
/// </summary>
/// <remarks>
/// <para>
/// On start: learns the bot's real username (<c>getMe</c>), publishes the command menu, then either
/// registers the webhook or — when there is no public HTTPS address, or Telegram refuses it — fetches
/// updates itself with long polling. Without this step <c>/start</c> reaches nobody, no account is ever
/// bound and the bot stays silent; it is what a fresh installation used to look like.
/// </para>
/// <para>
/// Runs in exactly one process (<see cref="TelegramOptions.ReceiveUpdates"/> is false on the worker):
/// Telegram answers a second poller, or polling alongside a webhook, with 409.
/// </para>
/// </remarks>
public sealed class TelegramUpdatesService(
    IServiceScopeFactory scopeFactory,
    TelegramBotApi api,
    TelegramBotIdentity identity,
    IOptions<TelegramOptions> options,
    ILogger<TelegramUpdatesService> logger) : BackgroundService
{
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan ConflictDelay = TimeSpan.FromSeconds(30);

    private readonly TelegramOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled || !_options.ReceiveUpdates || _options.UpdatesMode == "Off" || string.IsNullOrWhiteSpace(_options.BotToken))
        {
            return;
        }

        await IdentifyBotAsync(stoppingToken);

        try
        {
            await api.SetCommandsAsync(stoppingToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Cosmetic: the menu is a convenience, commands work without it.
            logger.LogWarning(exception, "Telegram: could not publish the bot command menu.");
        }

        if (await TryUseWebhookAsync(stoppingToken))
        {
            return;
        }

        await PollAsync(stoppingToken);
    }

    private async Task IdentifyBotAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var username = await api.GetUsernameAsync(stoppingToken);
                identity.Set(username);

                if (!string.Equals(username, _options.BotUsername, StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogWarning(
                        "Telegram: Telegram__BotUsername is '{Configured}' but the token belongs to '@{Actual}'. Links use '@{Actual}'.",
                        _options.BotUsername,
                        username,
                        username);
                }
                else
                {
                    logger.LogInformation("Telegram: bot @{Username} is reachable.", username);
                }

                return;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // A wrong token answers 401 and stays wrong; a network blip does not. Either way the
                // log says which, and the next attempt costs nothing.
                logger.LogError(exception, "Telegram: getMe failed — check Telegram__BotToken. Retrying in {Delay}.", RetryDelay);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }
    }

    private async Task<bool> TryUseWebhookAsync(CancellationToken stoppingToken)
    {
        if (_options.UpdatesMode == "Polling")
        {
            return false;
        }

        if (!_options.HasPublicWebhookUrl || !_options.HasUsableWebhookSecret)
        {
            var reason = !_options.HasPublicWebhookUrl
                ? "Telegram__WebhookUrl is not a public HTTPS address"
                : "Telegram__WebhookSecret is empty or has characters other than A-Z, a-z, 0-9, _ and -";

            if (_options.UpdatesMode == "Webhook")
            {
                logger.LogError("Telegram: webhook mode requested but {Reason}; the bot will not receive messages.", reason);
                return true;
            }

            logger.LogInformation("Telegram: {Reason}; receiving updates by long polling.", reason);
            return false;
        }

        try
        {
            await api.SetWebhookAsync(_options.WebhookUrl!, _options.WebhookSecret!, stoppingToken);
            logger.LogInformation("Telegram: webhook registered at {Url}.", _options.WebhookUrl);

            return true;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            if (_options.UpdatesMode == "Webhook")
            {
                logger.LogError(exception, "Telegram: setWebhook failed; the bot will not receive messages.");
                return true;
            }

            logger.LogWarning(exception, "Telegram: setWebhook failed; falling back to long polling.");
            return false;
        }
    }

    private async Task PollAsync(CancellationToken stoppingToken)
    {
        await RunUntilSucceededAsync(api.DeleteWebhookAsync, "deleteWebhook", stoppingToken);
        logger.LogInformation("Telegram: receiving updates by long polling.");

        long offset = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var updates = await api.GetUpdatesAsync(offset, stoppingToken);

                foreach (var update in updates)
                {
                    // Advanced before handling: an update that keeps failing must not block the queue.
                    if (update.TryGetProperty("update_id", out var id))
                    {
                        offset = Math.Max(offset, id.GetInt64() + 1);
                    }

                    await HandleAsync(update, stoppingToken);
                }
            }
            catch (TelegramApiException exception) when (exception.ErrorCode == 409)
            {
                // Another process polls, or a webhook was set behind our back.
                logger.LogWarning("Telegram: {Message}. Retrying in {Delay}.", exception.Message, ConflictDelay);
                await Task.Delay(ConflictDelay, stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Telegram: getUpdates failed. Retrying in {Delay}.", RetryDelay);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }
    }

    private async Task HandleAsync(System.Text.Json.JsonElement update, CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var handler = scope.ServiceProvider.GetRequiredService<TelegramUpdateHandler>();

            if (await handler.HandleAsync(update, stoppingToken) is { } reply)
            {
                await api.SendReplyAsync(reply, stoppingToken);
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // One bad update is logged and skipped; the person can simply press /start again.
            logger.LogError(exception, "Telegram: failed to handle an update.");
        }
    }

    private async Task RunUntilSucceededAsync(Func<CancellationToken, Task> call, string name, CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await call(stoppingToken);
                return;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Telegram: {Call} failed. Retrying in {Delay}.", name, RetryDelay);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }
    }
}
