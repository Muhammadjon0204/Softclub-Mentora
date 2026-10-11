using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Notifications;
using MentorTaskFlow.Infrastructure.Options;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Telegram;

/// <summary>
/// Answers whatever a person writes to the bot. Shared by the webhook and by long polling, so the bot
/// behaves the same whichever way updates arrive.
/// </summary>
/// <remarks>
/// The bot only binds accounts and explains itself; work on tasks happens in the application. Every
/// reply ends with a button back to Mentora so the next step is always one tap away.
/// </remarks>
public sealed class TelegramUpdateHandler(
    ITelegramService telegram,
    MentorTaskFlowDbContext dbContext,
    IOptions<NotificationOptions> notificationOptions)
{
    private const string OpenLabel = "Открыть Mentora";

    public async Task<TelegramReply?> HandleAsync(JsonElement update, CancellationToken cancellationToken)
    {
        var (chatId, text, firstName) = ReadMessage(update);

        if (chatId is null)
        {
            // An update we do not handle — an edited message, a channel post.
            return null;
        }

        var command = Command(text);

        return command switch
        {
            ("/start", { Length: > 0 } token) => await BindAsync(chatId, token, cancellationToken),
            ("/start", _) => await WelcomeAsync(chatId, firstName, cancellationToken),
            ("/status", _) => await StatusAsync(chatId, cancellationToken),
            _ => Help(chatId),
        };
    }

    private async Task<TelegramReply> BindAsync(string chatId, string token, CancellationToken cancellationToken)
    {
        var outcome = await telegram.RedeemBindTokenAsync(chatId, token, cancellationToken);

        if (outcome.BoundUserId is not { } userId)
        {
            return Reply(chatId, $"⚠️ {Escape(outcome.FailureReply ?? string.Empty)}", ProfileUrl());
        }

        var account = await FindAccountAsync(u => u.Id == userId, cancellationToken);

        var html =
            $"✅ <b>Готово! Telegram подключён к Mentora</b>\n\n"
            + (account is null ? string.Empty : $"{Describe(account)}\n\n")
            + "Сюда будут приходить:\n"
            + "• новые задания и изменения сроков\n"
            + "• напоминания о приближающихся дедлайнах\n"
            + "• сданные работы и решения по проверке\n\n"
            + "Письма на почту никуда не денутся. Отключить Telegram можно в профиле в любой момент.";

        return Reply(chatId, html, DashboardUrl(account));
    }

    private async Task<TelegramReply> WelcomeAsync(string chatId, string? firstName, CancellationToken cancellationToken)
    {
        var account = await FindAccountAsync(u => u.TelegramChatId == chatId, cancellationToken);
        var greeting = string.IsNullOrWhiteSpace(firstName) ? "Здравствуйте!" : $"Здравствуйте, {Escape(firstName)}!";

        if (account is not null)
        {
            return Reply(
                chatId,
                $"👋 <b>{greeting}</b>\n\nЭтот чат уже подключён к Mentora.\n{Describe(account)}\n\n"
                + "Уведомления о заданиях приходят сюда автоматически.",
                DashboardUrl(account));
        }

        return Reply(
            chatId,
            $"👋 <b>{greeting}</b>\n\nЭто бот уведомлений <b>Mentora</b>: новые задания, сроки, результаты проверки.\n\n"
            + "<b>Как подключить:</b>\n"
            + "1. Откройте профиль в Mentora\n"
            + "2. Нажмите «Подключить Telegram»\n"
            + "3. Вернитесь сюда и нажмите «Start»\n\n"
            + "Ссылка действует 15 минут.",
            ProfileUrl());
    }

    private async Task<TelegramReply> StatusAsync(string chatId, CancellationToken cancellationToken)
    {
        var account = await FindAccountAsync(u => u.TelegramChatId == chatId, cancellationToken);

        return account is null
            ? Reply(chatId, "Этот чат пока не подключён ни к одному аккаунту Mentora.\nПодключить можно в профиле — кнопка «Подключить Telegram».", ProfileUrl())
            : Reply(chatId, $"🔗 <b>Чат подключён к Mentora</b>\n\n{Describe(account)}", DashboardUrl(account));
    }

    private TelegramReply Help(string chatId) => Reply(
        chatId,
        "Этот бот доставляет уведомления Mentora. Действия по задачам выполняются в приложении.\n\n"
        + "/status — к какому аккаунту подключён чат\n"
        + "/start — подключение и приветствие",
        AppBaseUrl());

    private sealed record Account(string FullName, UserRole Role, AdminScope? Scope, string? Category, string? Branch);

    private async Task<Account?> FindAccountAsync(
        System.Linq.Expressions.Expression<Func<Domain.Users.User, bool>> predicate,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(predicate)
            .Where(u => u.IsActive)
            .Select(u => new { u.FullName, u.Role, u.AdminScope, u.CategoryId, u.BranchId })
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return null;
        }

        var category = user.CategoryId is { } categoryId
            ? await dbContext.Categories.IgnoreQueryFilters().AsNoTracking().Where(c => c.Id == categoryId).Select(c => c.Name).FirstOrDefaultAsync(cancellationToken)
            : null;
        var branch = user.BranchId is { } branchId
            ? await dbContext.Branches.IgnoreQueryFilters().AsNoTracking().Where(b => b.Id == branchId).Select(b => b.Name).FirstOrDefaultAsync(cancellationToken)
            : null;

        return new Account(user.FullName, user.Role, user.AdminScope, category, branch);
    }

    private static string Describe(Account account)
    {
        var place = string.Join(" · ", new[] { account.Category, account.Branch }.Where(part => !string.IsNullOrWhiteSpace(part)));

        return $"👤 <b>{Escape(account.FullName)}</b>\n{RoleLabel(account)}" + (place.Length > 0 ? $" · {Escape(place)}" : string.Empty);
    }

    private static string RoleLabel(Account account) => account.Role switch
    {
        UserRole.Mentor => "Ментор",
        UserRole.Lead => "Руководитель направления",
        _ => account.Scope is AdminScope.Organization ? "Администратор организации" : "Администратор филиала",
    };

    private static string RolePath(Account? account) => account?.Role switch
    {
        UserRole.Mentor => "mentor",
        UserRole.Lead => "lead",
        UserRole.Admin => "admin",
        _ => string.Empty,
    };

    private string AppBaseUrl() => notificationOptions.Value.AppBaseUrl.TrimEnd('/');

    private string DashboardUrl(Account? account) =>
        account is null ? AppBaseUrl() : $"{AppBaseUrl()}/{RolePath(account)}/dashboard";

    /// <summary>The chat is not bound, so the role — and the profile path — is unknown: the SPA signs the person in and takes them to their own dashboard, where the profile is one tap away.</summary>
    private string ProfileUrl() => $"{AppBaseUrl()}/";

    /// <summary>
    /// A button only for a public HTTPS address — Telegram rejects the whole message otherwise —
    /// and the address written out in the text for anything else (a local run).
    /// </summary>
    private static TelegramReply Reply(string chatId, string html, string url)
    {
        var isButtonUrl = Uri.TryCreate(url, UriKind.Absolute, out var uri)
                          && uri.Scheme == Uri.UriSchemeHttps
                          && uri.Host.Contains('.', StringComparison.Ordinal);

        return isButtonUrl
            ? new TelegramReply(chatId, html, OpenLabel, url)
            : new TelegramReply(chatId, $"{html}\n\n{OpenLabel}: {Escape(url)}");
    }

    private static string Escape(string value) => NotificationTemplates.TelegramEscape(value);

    private static (string Name, string Argument) Command(string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || !text.StartsWith('/'))
        {
            return (string.Empty, string.Empty);
        }

        var parts = text.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        // «/start@mentora_bot» in group chats: the suffix names the bot, not the command.
        var name = parts[0].Split('@', 2)[0].ToLowerInvariant();

        return (name, parts.Length is 2 ? parts[1] : string.Empty);
    }

    private static (string? ChatId, string? Text, string? FirstName) ReadMessage(JsonElement update)
    {
        if (!update.TryGetProperty("message", out var message))
        {
            return (null, null, null);
        }

        var chatId = message.TryGetProperty("chat", out var chat) && chat.TryGetProperty("id", out var id)
            ? id.ValueKind is JsonValueKind.Number ? id.GetInt64().ToString() : id.GetString()
            : null;

        var text = message.TryGetProperty("text", out var value) && value.ValueKind is JsonValueKind.String ? value.GetString() : null;

        var firstName = message.TryGetProperty("from", out var from)
                        && from.TryGetProperty("first_name", out var first)
                        && first.ValueKind is JsonValueKind.String
            ? first.GetString()
            : null;

        return (chatId, text, firstName);
    }
}
