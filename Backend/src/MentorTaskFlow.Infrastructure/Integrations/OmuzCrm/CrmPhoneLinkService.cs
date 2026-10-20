using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>What became of a phone shared in the bot.</summary>
public enum CrmPhoneLinkResult
{
    Linked,
    AlreadyLinked,
    ChatNotBound,
    NotMentorOrLead,
    NotFound,
    Ambiguous,
    TakenByAnother,
    CrmUnavailable,
}

public sealed record CrmPhoneLinkOutcome(CrmPhoneLinkResult Result, string? MentorName = null, int CurrentGroups = 0);

/// <summary>
/// Links a person to their CRM mentor by the phone they shared in the Telegram bot.
/// </summary>
/// <remarks>
/// <para>
/// The phone is the one the CRM itself signs the mentor in with, and Telegram confirms it: a contact
/// shared through the «Поделиться номером» button is the sender's own account number, which the bot
/// checks (<c>contact.user_id == from.id</c>) before calling this. A number typed in by hand is never
/// accepted — it could be anyone's, and the link opens that mentor's groups and students.
/// </para>
/// <para>
/// The match is made on the last nine digits: the CRM keeps local numbers (<c>931234567</c>), Telegram
/// sends them with the country code (<c>992931234567</c>).
/// </para>
/// </remarks>
public sealed class CrmPhoneLinkService(
    MentorTaskFlowDbContext dbContext,
    OmuzCrmClient client,
    IClock clock,
    IAuditWriter auditWriter,
    ILogger<CrmPhoneLinkService> logger)
{
    private const int LocalDigits = 9;

    /// <summary>Whether the bot should offer the button to the person behind <paramref name="chatId"/>.</summary>
    public async Task<bool> CanOfferAsync(string chatId, CancellationToken cancellationToken) =>
        client.IsConfigured
        && await dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.TelegramChatId == chatId && u.IsActive && u.Role != UserRole.Admin && u.CrmMentorId == null, cancellationToken);

    public async Task<CrmPhoneLinkOutcome> LinkAsync(string chatId, string phone, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.TelegramChatId == chatId && u.IsActive, cancellationToken);

        if (user is null)
        {
            return new(CrmPhoneLinkResult.ChatNotBound);
        }

        if (user.Role is UserRole.Admin)
        {
            return new(CrmPhoneLinkResult.NotMentorOrLead);
        }

        var digits = Digits(phone);
        if (digits.Length < LocalDigits)
        {
            return new(CrmPhoneLinkResult.NotFound);
        }

        IReadOnlyList<CrmMentor> mentors;
        try
        {
            mentors = client.IsConfigured ? await client.ListMentorsAsync(cancellationToken) : [];
        }
        catch (Exception exception) when (exception is CrmUnauthorizedException or CrmUnavailableException or CrmRequestException)
        {
            logger.LogWarning(exception, "CRM unavailable while linking by phone.");
            return new(CrmPhoneLinkResult.CrmUnavailable);
        }

        if (!client.IsConfigured)
        {
            return new(CrmPhoneLinkResult.CrmUnavailable);
        }

        var local = digits[^LocalDigits..];
        var matches = mentors.Where(m => Digits(m.PhoneNumber) is { Length: >= LocalDigits } p && p[^LocalDigits..] == local).ToList();

        if (matches.Count == 0)
        {
            return new(CrmPhoneLinkResult.NotFound);
        }

        if (matches.Count > 1)
        {
            return new(CrmPhoneLinkResult.Ambiguous);
        }

        var mentor = matches[0];
        var name = CrmJournalScoring.NormalizeName($"{mentor.Name} {mentor.Surname}");
        var groups = (mentor.Groups ?? []).Count(g => g.IsCurrent && g.MentorStatus.Id != CrmValues.MentorRemoved);

        if (user.CrmMentorId == mentor.Id)
        {
            return new(CrmPhoneLinkResult.AlreadyLinked, name, groups);
        }

        // The CRM mentor already belongs to someone else: only the Organization Admin may move it —
        // a person must not be able to take another account's link by sharing a number.
        var taken = await dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.OrganizationId == user.OrganizationId && u.CrmMentorId == mentor.Id && u.Id != user.Id, cancellationToken);
        if (taken)
        {
            return new(CrmPhoneLinkResult.TakenByAnother, name);
        }

        var now = clock.UtcNow;
        user.SetVerifiedPhone(digits, now);
        user.LinkCrmMentor(mentor.Id, now);

        auditWriter.WriteSystem(
            new AuditEntry
            {
                Action = AuditActions.CrmMentorLink,
                EntityType = nameof(Domain.Users.User),
                EntityId = user.Id,
                BranchId = user.BranchId,
                CategoryId = user.CategoryId,
                Metadata = JsonSerializer.SerializeToDocument(new { crmMentorId = mentor.Id, linked = true, source = "telegram_contact" }),
            },
            user.OrganizationId,
            user.BranchId);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
                                                  {
                                                      SqlState: PostgresErrorCodes.UniqueViolation,
                                                      ConstraintName: "ux_users_organization_crm_mentor",
                                                  })
        {
            return new(CrmPhoneLinkResult.TakenByAnother, name);
        }

        return new(CrmPhoneLinkResult.Linked, name, groups);
    }

    public static string Digits(string? value) => new((value ?? string.Empty).Where(char.IsAsciiDigit).ToArray());
}
