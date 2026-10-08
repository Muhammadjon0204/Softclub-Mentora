using System.Net;
using System.Text.Json;
using MentorTaskFlow.Domain.Notifications;

namespace MentorTaskFlow.Infrastructure.Notifications;

/// <summary>A rendered message, in the shape each channel needs.</summary>
/// <param name="Subject">Email subject; also the bold first line in Telegram.</param>
/// <param name="PlainText">Email text part.</param>
/// <param name="Html">Email HTML part.</param>
/// <param name="TelegramHtml">Telegram body in its HTML subset (<c>parse_mode=HTML</c>), without the link.</param>
/// <param name="ActionUrl">Absolute link to the place to act, or null when there is none.</param>
/// <param name="ActionLabel">Text of the button that opens <paramref name="ActionUrl"/>.</param>
public sealed record RenderedMessage(
    string Subject,
    string PlainText,
    string Html,
    string TelegramHtml,
    string? ActionUrl,
    string ActionLabel);

/// <summary>
/// Russian templates for the event catalog (<c>NTF-019</c>).
/// </summary>
/// <remarks>
/// <para>
/// Versioned with the code rather than stored in the database: a template referring to a payload field
/// that no longer exists must fail review, not production.
/// </para>
/// <para>
/// <c>NTF-018</c> fixes the minimum content — what happened, to which task, by when — and
/// <c>NTF-017</c> the maximum: no tokens, no presigned URLs, no third-party personal data. The link
/// goes to the application, where access is checked again, and never to storage. The fields used here
/// are added at enqueue by <see cref="NotificationPayloadEnricher"/>; a row written before it existed
/// simply renders without them and links to the application's start page.
/// </para>
/// </remarks>
public static class NotificationTemplates
{
    public static RenderedMessage Render(string eventType, JsonDocument payload, string appBaseUrl, string? actionUrl = null)
    {
        var body = payload.RootElement;
        var title = TryGetString(body, "assignmentTitle");
        var mentor = TryGetString(body, "mentorFullName");
        var quotedTitle = title is null ? "задача" : $"«{title}»";

        var (subject, lead, actionLabel) = eventType switch
        {
            NotificationEventTypes.AssignmentAssigned =>
                ("Новое задание", $"Вам назначено задание {quotedTitle}.", "Открыть задание"),

            NotificationEventTypes.AssignmentSuggested =>
                ("Планировщик предложил задание", $"Планировщик подготовил задание {quotedTitle}{ForMentor(mentor)}. Его нужно подтвердить.", "Посмотреть предложение"),

            NotificationEventTypes.AssignmentReassigned =>
                ("Исполнитель задания изменён", $"Задание {quotedTitle} передано другому исполнителю.", "Открыть задание"),

            NotificationEventTypes.SubmissionUploaded =>
                ("Работа сдана на проверку", mentor is null
                    ? $"Ментор сдал задание {quotedTitle}. Зайдите и проверьте."
                    : $"Ваш ментор {mentor} сдал задание {quotedTitle}. Зайдите и проверьте.", "Открыть и проверить"),

            NotificationEventTypes.LateSubmissionUploaded =>
                ("Работа сдана с опозданием", mentor is null
                    ? $"Ментор сдал задание {quotedTitle} после дедлайна. Зайдите и проверьте."
                    : $"Ваш ментор {mentor} сдал задание {quotedTitle} после дедлайна. Зайдите и проверьте.", "Открыть и проверить"),

            NotificationEventTypes.ReviewApproved =>
                ("Работа принята", $"Ваша работа по заданию {quotedTitle} принята.", "Открыть задание"),

            NotificationEventTypes.ReviewNeedsRework =>
                ("Работа возвращена на доработку", $"Работу по заданию {quotedTitle} нужно доработать. Комментарий руководителя — в приложении.", "Открыть задание"),

            NotificationEventTypes.DeadlineReminder =>
                ("Скоро дедлайн", $"Срок сдачи задания {quotedTitle} скоро истекает.", "Открыть задание"),

            NotificationEventTypes.AssignmentOverdue =>
                ("Задание просрочено", mentor is null
                    ? $"Срок сдачи задания {quotedTitle} истёк."
                    : $"Срок сдачи задания {quotedTitle} истёк. Исполнитель: {mentor}.", "Открыть задание"),

            NotificationEventTypes.AssignmentCancelled =>
                ("Задание отменено", $"Задание {quotedTitle} отменено.", "Открыть задание"),

            NotificationEventTypes.SchedulerNoActiveMentor =>
                ("В категории нет активных менторов", "Планировщик не нашёл активных менторов в категории.", "Открыть приложение"),

            NotificationEventTypes.CategoryWithoutLead =>
                ("В категории нет активного руководителя", "Категория осталась без активного руководителя направления.", "Открыть приложение"),

            NotificationEventTypes.BranchDeactivated =>
                ("Филиал деактивирован", "Филиал деактивирован: операции записи в его контуре недоступны.", "Открыть приложение"),

            NotificationEventTypes.BranchActivated =>
                ("Филиал снова активен", "Филиал активирован.", "Открыть приложение"),

            NotificationEventTypes.UserBranchChanged =>
                ("Вы переведены в другой филиал", "Вы переведены в другой филиал. Войдите в систему заново.", "Войти"),

            NotificationEventTypes.BranchWithoutAdmin =>
                ("В филиале нет администратора", "Филиал остался без активного администратора.", "Открыть приложение"),

            NotificationEventTypes.OrganizationSystemAlert =>
                ("Системное оповещение", "Зафиксировано событие, требующее внимания администратора.", "Открыть приложение"),

            NotificationEventTypes.NotificationDeadLetter =>
                ("Уведомления не доставляются", "Часть уведомлений не удалось доставить.", "Открыть приложение"),

            NotificationEventTypes.UserInvitation =>
                ("Приглашение в Mentora", "Для вас создана учётная запись. Установите пароль, чтобы войти.", "Установить пароль"),

            _ => ("Уведомление Mentora", "Произошло событие в системе.", "Открыть приложение"),
        };

        var details = new List<string>();

        if (TryGetString(body, "submittedAtLocal") is { } submittedAt)
        {
            details.Add($"Сдано: {submittedAt}");
        }

        if (body.TryGetProperty("versionNumber", out var version) && version.TryGetInt32(out var versionNumber) && versionNumber > 1)
        {
            details.Add($"Версия: {versionNumber}");
        }

        if (TryGetString(body, "dueAtLocal") is { } dueAt)
        {
            details.Add(eventType is NotificationEventTypes.ReviewNeedsRework ? $"Новый срок: {dueAt}" : $"Срок: {dueAt}");
        }

        if (TryGetString(body, "branchName") is { } branchName)
        {
            details.Add($"Филиал: {branchName}");
        }

        if (TryGetString(body, "categoryName") is { } categoryName)
        {
            details.Add($"Категория: {categoryName}");
        }

        if (TryGetString(body, "subjectFullName") is { } subjectName)
        {
            details.Add($"Сотрудник: {subjectName}");
        }

        if (body.TryGetProperty("failedCount", out var failed) && failed.TryGetInt32(out var count))
        {
            details.Add($"Не доставлено уведомлений за период: {count}.");
        }

        // UserInvitation carries a real, single-use action link (minted by the dispatcher at send
        // time, never persisted — NTF-017); assignment events a relative path into the app; anything
        // else the start page.
        var link = actionUrl ?? (TryGetString(body, "actionPath") is { } path && path.StartsWith('/')
            ? appBaseUrl.TrimEnd('/') + path
            : appBaseUrl);

        var plainLines = new List<string> { lead };
        plainLines.AddRange(details);
        plainLines.Add($"{actionLabel}: {link}");

        var html = $"<p>{WebUtility.HtmlEncode(lead)}</p>"
                   + (details.Count > 0 ? $"<p>{string.Join("<br/>", details.Select(WebUtility.HtmlEncode))}</p>" : string.Empty)
                   + $"<p><a href=\"{WebUtility.HtmlEncode(link)}\">{WebUtility.HtmlEncode(actionLabel)}</a></p>";

        var telegram = $"<b>{TelegramEscape(subject)}</b>\n\n{TelegramEscape(lead)}"
                       + (details.Count > 0 ? "\n\n" + string.Join("\n", details.Select(TelegramEscape)) : string.Empty);

        return new RenderedMessage(subject, string.Join("\n", plainLines), html, telegram, link, actionLabel);
    }

    /// <summary>
    /// The three characters Telegram's HTML mode requires escaped — and nothing else, so «quotes» and
    /// the rest of the text stay readable in the raw message instead of becoming numeric entities.
    /// </summary>
    public static string TelegramEscape(string value) => value
        .Replace("&", "&amp;", StringComparison.Ordinal)
        .Replace("<", "&lt;", StringComparison.Ordinal)
        .Replace(">", "&gt;", StringComparison.Ordinal);

    private static string ForMentor(string? mentor) => mentor is null ? string.Empty : $" для {mentor}";

    private static string? TryGetString(JsonElement body, string name) =>
        body.TryGetProperty(name, out var value) && value.ValueKind is JsonValueKind.String
            ? value.GetString()
            : null;
}
