using System.Text;
using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Integrations;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <inheritdoc />
public sealed class CrmLinkService(
    MentorTaskFlowDbContext dbContext,
    OmuzCrmClient client,
    IClock clock,
    IAuditWriter auditWriter,
    ILogger<CrmLinkService> logger) : ICrmLinkService
{
    public async Task<CrmLinksDto> GetLinksAsync(CancellationToken cancellationToken)
    {
        var crmMentors = await CrmCall.RunAsync(client, logger, () => client.ListMentorsAsync(cancellationToken));
        var crmBranches = await CrmCall.RunAsync(client, logger, () => client.GetBranchesAsync(cancellationToken));

        var users = await dbContext.Users
            .Where(u => u.Role != UserRole.Admin && u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.Role, u.BranchId, u.CrmMentorId })
            .ToListAsync(cancellationToken);

        var branches = await dbContext.Branches
            .OrderBy(b => b.Name)
            .Select(b => new { b.Id, b.Name, b.CrmBranchId })
            .ToListAsync(cancellationToken);
        var branchNames = branches.ToDictionary(b => b.Id, b => b.Name);

        var linkedUsers = users.Where(u => u.CrmMentorId is not null).ToDictionary(u => u.CrmMentorId!.Value);
        var freeUsers = users.Where(u => u.CrmMentorId is null).Select(u => (u.Id, u.FullName, Key: NameKey(u.FullName))).ToList();

        var mentors = crmMentors
            .OrderBy(m => m.Status.Id)
            .ThenBy(m => m.Surname)
            .Select(m =>
            {
                var fullName = CrmJournalScoring.NormalizeName($"{m.Name} {m.Surname}");
                linkedUsers.TryGetValue(m.Id, out var linked);

                // Suggested only when exactly one free account carries the same name: two namesakes
                // are for the admin to tell apart, not for a guess.
                var crmKey = NameKey(fullName);
                var matches = linked is null && crmKey.Count >= 2
                    ? freeUsers.Where(u => crmKey.IsSubsetOf(u.Key)).ToList()
                    : [];
                var suggestion = matches.Count == 1 ? matches[0] : default;

                return new CrmMentorLinkDto(
                    m.Id,
                    fullName,
                    MaskPhone(m.PhoneNumber),
                    m.Branch?.Name.Trim(),
                    m.Status.Id == 0,
                    (m.Groups ?? []).Count(g => g.IsCurrent && g.MentorStatus.Id != CrmValues.MentorRemoved),
                    linked?.Id,
                    linked?.FullName,
                    matches.Count == 1 ? suggestion.Id : null,
                    matches.Count == 1 ? suggestion.FullName : null);
            })
            .ToList();

        var branchByCrm = branches.Where(b => b.CrmBranchId is not null).ToDictionary(b => b.CrmBranchId!.Value);
        var branchLinks = crmBranches
            .OrderBy(b => b.Name)
            .Select(b =>
            {
                branchByCrm.TryGetValue(b.Id, out var linked);
                var key = NameKey(b.Name);
                var matches = linked is null
                    ? branches.Where(x => x.CrmBranchId is null && NameKey(x.Name).SetEquals(key)).ToList()
                    : [];
                return new CrmBranchLinkDto(b.Id, b.Name.Trim(), linked?.Id, linked?.Name, matches.Count == 1 ? matches[0].Id : null);
            })
            .ToList();

        return new CrmLinksDto(
            mentors,
            branchLinks,
            users.Select(u => new CrmLinkableUserDto(
                u.Id,
                u.FullName,
                u.Role.ToString(),
                u.BranchId is { } b && branchNames.TryGetValue(b, out var name) ? name : null,
                u.CrmMentorId)).ToList(),
            branches.Select(b => new CrmLinkableBranchDto(b.Id, b.Name, b.CrmBranchId)).ToList());
    }

    public async Task LinkMentorAsync(int crmMentorId, Guid? userId, CancellationToken cancellationToken)
    {
        var crmMentors = await CrmCall.RunAsync(client, logger, () => client.ListMentorsAsync(cancellationToken));
        if (crmMentors.All(m => m.Id != crmMentorId))
        {
            throw new NotFoundException("Ментор в CRM не найден.");
        }

        var now = clock.UtcNow;
        var previous = await dbContext.Users.FirstOrDefaultAsync(u => u.CrmMentorId == crmMentorId, cancellationToken);
        if (previous is not null && previous.Id == userId)
        {
            return;
        }

        // A CRM mentor is one person: linking them to a new account takes them off the old one, in the
        // same save — the unique index would refuse two.
        if (previous is not null)
        {
            previous.LinkCrmMentor(null, now);
            Audit(previous, crmMentorId, linked: false);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (userId is { } id)
        {
            var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken)
                       ?? throw new NotFoundException("Пользователь не найден.");
            user.LinkCrmMentor(crmMentorId, now);
            Audit(user, crmMentorId, linked: true);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task LinkBranchAsync(int crmBranchId, Guid? branchId, CancellationToken cancellationToken)
    {
        var crmBranches = await CrmCall.RunAsync(client, logger, () => client.GetBranchesAsync(cancellationToken));
        if (crmBranches.All(b => b.Id != crmBranchId))
        {
            throw new NotFoundException("Филиал в CRM не найден.");
        }

        var now = clock.UtcNow;
        var previous = await dbContext.Branches.FirstOrDefaultAsync(b => b.CrmBranchId == crmBranchId, cancellationToken);
        if (previous is not null && previous.Id == branchId)
        {
            return;
        }

        if (previous is not null)
        {
            previous.LinkCrmBranch(null, now);
            AuditBranch(previous.Id, crmBranchId, linked: false);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (branchId is { } id)
        {
            var branch = await dbContext.Branches.FirstOrDefaultAsync(b => b.Id == id, cancellationToken)
                         ?? throw new NotFoundException("Филиал не найден.");
            branch.LinkCrmBranch(crmBranchId, now);
            AuditBranch(branch.Id, crmBranchId, linked: true);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private void Audit(Domain.Users.User user, int crmMentorId, bool linked) =>
        auditWriter.Write(new AuditEntry
        {
            Action = AuditActions.CrmMentorLink,
            EntityType = nameof(Domain.Users.User),
            EntityId = user.Id,
            BranchId = user.BranchId,
            CategoryId = user.CategoryId,
            Metadata = JsonSerializer.SerializeToDocument(new { crmMentorId, linked }),
        });

    private void AuditBranch(Guid branchId, int crmBranchId, bool linked) =>
        auditWriter.Write(new AuditEntry
        {
            Action = AuditActions.CrmBranchLink,
            EntityType = nameof(Branch),
            EntityId = branchId,
            BranchId = branchId,
            Metadata = JsonSerializer.SerializeToDocument(new { crmBranchId, linked }),
        });

    /// <summary>«93•••••97»: enough for an admin to recognise a number, not enough to copy it.</summary>
    public static string? MaskPhone(string? phone)
    {
        var digits = new string((phone ?? string.Empty).Where(char.IsDigit).ToArray());
        return digits.Length < 5 ? null : $"{digits[..2]}{new string('•', digits.Length - 4)}{digits[^2..]}";
    }

    /// <summary>
    /// A name as a set of comparable words: lower case, Cyrillic transliterated, and the spellings that
    /// differ between the CRM's Latin and a Cyrillic name collapsed — «Джумаев Хаким» and
    /// «Hakim Jumaev» give the same set.
    /// </summary>
    public static HashSet<string> NameKey(string? name)
    {
        var latin = new StringBuilder();
        foreach (var c in (name ?? string.Empty).ToLowerInvariant())
        {
            latin.Append(Translit.TryGetValue(c, out var t) ? t : c.ToString());
        }

        var simplified = latin.ToString()
            .Replace("dzh", "j").Replace("zh", "j").Replace("kh", "h").Replace("x", "h")
            .Replace("yo", "o").Replace("ya", "a").Replace("yu", "u").Replace("y", "i")
            .Replace("'", string.Empty);

        return simplified
            .Split([' ', '-', '.', ','], StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 1)
            .ToHashSet();
    }

    private static readonly Dictionary<char, string> Translit = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['ғ'] = "gh", ['д'] = "d", ['е'] = "e", ['ё'] = "yo",
        ['ж'] = "zh", ['з'] = "z", ['и'] = "i", ['ӣ'] = "i", ['й'] = "y", ['к'] = "k", ['қ'] = "q", ['л'] = "l",
        ['м'] = "m", ['н'] = "n", ['о'] = "o", ['п'] = "p", ['р'] = "r", ['с'] = "s", ['т'] = "t", ['у'] = "u",
        ['ӯ'] = "u", ['ф'] = "f", ['х'] = "kh", ['ҳ'] = "h", ['ц'] = "ts", ['ч'] = "ch", ['ҷ'] = "j", ['ш'] = "sh",
        ['щ'] = "sh", ['ъ'] = "", ['ы'] = "y", ['ь'] = "", ['э'] = "e", ['ю'] = "yu", ['я'] = "ya",
    };
}
