using System.Diagnostics;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Integrations;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <inheritdoc />
/// <remarks>
/// Reads are cached for half a minute: the preview is opened and re-opened while someone looks at it,
/// and the CRM, which has no per-key limit of its own, should not pay for every click.
/// </remarks>
public sealed class CrmIntegrationService(
    OmuzCrmClient client,
    IMemoryCache cache,
    IOptions<OmuzCrmOptions> options,
    IClock clock,
    CrmAccessResolver accessResolver,
    Telegram.TelegramBotIdentity botIdentity,
    IOptions<TelegramOptions> telegramOptions,
    ILogger<CrmIntegrationService> logger) : ICrmIntegrationService
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);
    private readonly OmuzCrmOptions _options = options.Value;
    private readonly TimeZoneInfo _zone = ResolveZone(options.Value.TimeZoneId);

    private static readonly Dictionary<string, int> StatusIds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Preparing"] = CrmValues.GroupPreparing,
        ["Started"] = CrmValues.GroupStarted,
        ["Finished"] = CrmValues.GroupFinished,
    };

    public async Task<CrmStatusDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        if (!client.IsConfigured)
        {
            return new CrmStatusDto(false, false, _options.BaseUrl, null, null, null, "Не задан ключ API (OmuzCrm__ApiKey).", [], []);
        }

        var watch = Stopwatch.StartNew();
        try
        {
            var ping = await client.PingAsync(cancellationToken);
            var latency = (int)watch.ElapsedMilliseconds;
            var branches = await client.GetBranchesAsync(cancellationToken);
            var courses = await client.GetCoursesAsync(cancellationToken);

            return new CrmStatusDto(
                true, true, _options.BaseUrl, ping?.KeyName, ping?.ServerTime, latency, null,
                branches.Select(ToDto).ToList(),
                courses.Select(ToDto).ToList());
        }
        catch (Exception exception) when (exception is CrmUnauthorizedException or CrmUnavailableException or CrmRequestException)
        {
            logger.LogWarning(exception, "CRM status check failed.");
            return new CrmStatusDto(true, false, _options.BaseUrl, null, null, null, exception.Message, [], []);
        }
    }

    public async Task<CrmAccessDto> GetAccessAsync(CancellationToken cancellationToken)
    {
        var access = await accessResolver.ResolveAsync(cancellationToken);
        var (canSelfLink, telegramBound) = await accessResolver.SelfLinkAsync(cancellationToken);
        var bot = botIdentity.Username ?? telegramOptions.Value.BotUsername;

        return new CrmAccessDto(
            access.Scope,
            access.Ready,
            access.Missing,
            access.MentorIds.Count,
            canSelfLink && client.IsConfigured && !string.IsNullOrWhiteSpace(bot),
            telegramBound,
            string.IsNullOrWhiteSpace(bot) ? null : $"https://t.me/{bot}",
            client.IsConfigured);
    }

    public async Task<CrmGroupListDto> ListGroupsAsync(string status, CancellationToken cancellationToken)
    {
        if (!StatusIds.TryGetValue(status, out var statusId))
        {
            throw new ValidationAppException("status", "Статус группы: Preparing, Started или Finished.");
        }

        var access = await accessResolver.ResolveAsync(cancellationToken);
        if (!access.Ready)
        {
            return new CrmGroupListDto([]);
        }

        var all = await AllGroupsAsync(statusId, cancellationToken);
        if (access.Scope is CrmAccess.Organization or CrmAccess.Branch)
        {
            return new CrmGroupListDto(all.Groups.Where(g => access.Sees(g.Branch.Id, [])).ToList());
        }

        // Every group the person's mentors have ever taught: a mentor who was taken off a group still
        // wrote its earlier weeks.
        var taught = (await MentorsAsync(cancellationToken))
            .Where(m => access.MentorIds.Contains(m.Id))
            .SelectMany(m => m.Groups ?? [])
            .Select(g => g.Id)
            .ToHashSet();

        return new CrmGroupListDto(all.Groups.Where(g => taught.Contains(g.Id)).ToList());
    }

    private Task<CrmGroupListDto> AllGroupsAsync(int statusId, CancellationToken cancellationToken) =>
        Cached($"crm:groups:{statusId}", async () =>
        {
            var groups = await Call(() => client.ListGroupsAsync(statusId, cancellationToken));

            // The group list carries no mentors; the mentor list carries every mentor's groups. One
            // request turns it into «who teaches this group now» for the whole list.
            var current = (await CurrentMentorsAsync(cancellationToken));
            return new CrmGroupListDto(groups
                .OrderByDescending(g => g.StartsAt)
                .Select(g => ToDto(g) with { CurrentMentors = current.TryGetValue(g.Id, out var names) ? names : [] })
                .ToList());
        });

    private Task<IReadOnlyList<CrmMentor>> MentorsAsync(CancellationToken cancellationToken) =>
        Cached("crm:mentors:all", () => Call(() => client.ListMentorsAsync(cancellationToken)));

    private Task<Dictionary<int, IReadOnlyList<string>>> CurrentMentorsAsync(CancellationToken cancellationToken) =>
        Cached("crm:mentors:current", async () =>
        {
            var mentors = await MentorsAsync(cancellationToken);
            return mentors
                .SelectMany(m => (m.Groups ?? [])
                    .Where(g => g.IsCurrent && g.MentorStatus.Id != CrmValues.MentorRemoved)
                    .Select(g => (GroupId: g.Id, Name: CrmJournalScoring.NormalizeName($"{m.Name} {m.Surname}") + (g.MentorStatus.Id == CrmValues.MentorSupport ? " (помогает)" : ""))))
                .GroupBy(x => x.GroupId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.Name).ToList());
        });

    public async Task<CrmGroupPreviewDto> GetGroupPreviewAsync(int groupId, CancellationToken cancellationToken)
    {
        var access = await accessResolver.ResolveAsync(cancellationToken);
        if (!access.Ready)
        {
            throw new NotFoundException("Группа в CRM не найдена.");
        }

        var preview = await PreviewAsync(groupId, cancellationToken);

        // Out of scope reads as «not found»: «forbidden» would confirm the group exists.
        return access.Sees(preview.Group.Branch.Id, preview.Mentors.Select(m => m.Id))
            ? preview
            : throw new NotFoundException("Группа в CRM не найдена.");
    }

    private Task<CrmGroupPreviewDto> PreviewAsync(int groupId, CancellationToken cancellationToken) =>
        Cached($"crm:group:{groupId}", async () =>
        {
            var group = await Call(() => client.GetGroupAsync(groupId, cancellationToken))
                        ?? throw new NotFoundException("Группа в CRM не найдена.");
            var journal = await Call(() => client.GetJournalAsync(groupId, cancellationToken));

            var mentors = (group.Mentors ?? [])
                .OrderBy(m => m.StartedAt)
                .Select(m => new CrmGroupMentorDto(m.Id, CrmJournalScoring.NormalizeName(m.FullName), RoleOf(m.Status.Id), Local(m.StartedAt), m.EndedAt is { } e ? Local(e) : null))
                .ToList();

            var membership = (group.Students ?? []).ToDictionary(
                s => s.Id,
                s => (Joined: Local(s.JoinedAt), Left: s.LeftAt is { } l ? Local(l) : (DateOnly?)null));
            var students = (group.Students ?? [])
                .Select(s => new CrmGroupStudentDto(
                    s.Id,
                    CrmJournalScoring.NormalizeName($"{s.FirstName} {s.LastName}"),
                    s.Status.Name,
                    Local(s.JoinedAt),
                    s.LeftAt is { } left ? Local(left) : null,
                    string.IsNullOrWhiteSpace(s.Note) ? null : s.Note.Trim()))
                .ToList();

            var today = Local(clock.UtcNow);
            var scored = (journal ?? [])
                .OrderByDescending(p => p.Week)
                .Select(p => (Period: p, Scores: ScorePeriod(p, membership, today), Closed: IsClosed(p, today)))
                .ToList();

            return new CrmGroupPreviewDto(
                ToDto(group),
                mentors,
                students,
                scored.Select(p => ToPeriod(p.Period, p.Scores, p.Closed, mentors)).ToList(),
                Overall(scored),
                journal is null ? "У группы нет расписания — журнала в CRM нет." : null);
        });

    private static List<CrmStudentPeriodScore> ScorePeriod(
        CrmJournalPeriod period,
        IReadOnlyDictionary<int, (DateOnly Joined, DateOnly? Left)> membership,
        DateOnly today) =>
        period.Students
            .Select(s => membership.TryGetValue(s.Id, out var m)
                ? CrmJournalScoring.Score(period, s, m.Joined, m.Left, today)
                : CrmJournalScoring.Score(period, s, today: today))

            // Not in the group that week (joined later, left earlier) and nothing counted either.
            .Where(s => s.ExpectedDays > 0 || s.LessonsCounted > 0 || s.ExamGrade is not null)
            .OrderBy(s => FillOrder(s.Fill))
            .ThenByDescending(s => s.Total)
            .ToList();

    private static int FillOrder(string fill) => fill switch { CrmFill.Full => 0, CrmFill.Partial => 1, _ => 2 };

    private static double? Percent(int part, int whole) => whole == 0 ? null : Math.Round(100.0 * part / whole, 1);

    /// <summary>
    /// The group over the closed weeks. A student's result is the <b>average</b> of their weekly totals
    /// — weeks are never added up — over the weeks the mentor filled in completely; the weeks the
    /// student was in the group but the journal is partly or not at all filled in are counted, not
    /// averaged. The group's result is the average of its students.
    /// </summary>
    private static CrmOverallDto Overall(IReadOnlyList<(CrmJournalPeriod Period, List<CrmStudentPeriodScore> Scores, bool Closed)> periods)
    {
        var closed = periods.Where(p => p.Closed).ToList();
        var students = closed
            .SelectMany(p => p.Scores.Where(s => s.ExpectedDays > 0))
            .GroupBy(s => s.StudentId)
            .Select(g =>
            {
                var full = g.Where(s => s.Fill == CrmFill.Full).ToList();
                double? average = full.Count == 0 ? null : Math.Round(full.Average(s => s.Total), 1);
                return new CrmStudentOverallDto(
                    g.Key,
                    g.First().FullName,
                    average,
                    average is { } a ? CrmJournalScoring.ZoneOf(a) : null,
                    g.Count(),
                    full.Count,
                    g.Count(s => s.Fill == CrmFill.Partial),
                    g.Count(s => s.Fill == CrmFill.Empty),
                    full.Count == 0 ? null : full.Min(s => s.Total),
                    full.Count == 0 ? null : full.Max(s => s.Total),
                    g.Sum(s => s.Attended),
                    g.Sum(s => s.Absent),
                    g.Sum(s => s.LateDays.Count));
            })
            .OrderByDescending(s => s.AverageTotal ?? -1)
            .ToList();

        var rated = students.Where(s => s.AverageTotal is not null).ToList();
        var all = closed.SelectMany(p => p.Scores).ToList();
        var attended = all.Sum(s => s.Attended);
        return new CrmOverallDto(
            closed.Count,
            rated.Count,
            rated.Count == 0 ? null : Math.Round(rated.Average(s => s.AverageTotal!.Value), 1),
            rated.Count(s => s.Zone == "Pass"),
            rated.Count(s => s.Zone == "Support"),
            rated.Count(s => s.Zone == "Risk"),
            Percent(attended, attended + all.Sum(s => s.Absent)),
            Percent(all.Sum(s => s.FilledDays), all.Sum(s => s.ExpectedDays)),
            students);
    }

    /// <summary>
    /// A period is over when the CRM says so — or when its last day is behind us: the CRM never closes the
    /// last period of a finished group (seen on the test server: «Python - 1» ended in 2025, its only
    /// period is still <c>isComplete: false</c>).
    /// </summary>
    private static bool IsClosed(CrmJournalPeriod period, DateOnly today) =>
        period.IsComplete || (period.Days.Count > 0 && period.Days.Max(d => CrmJournalScoring.DateOf(d.Date)) < today);

    private static CrmPeriodDto ToPeriod(CrmJournalPeriod period, List<CrmStudentPeriodScore> scores, bool closed, IReadOnlyList<CrmGroupMentorDto> mentors)
    {
        var dates = period.Days.Select(d => CrmJournalScoring.DateOf(d.Date)).ToList();
        var from = dates.Count > 0 ? dates.Min() : default;
        var to = dates.Count > 0 ? dates.Max() : default;

        var teaching = mentors
            .Where(m => m.From <= to && (m.To is null || m.To >= from))
            .Select(m => m.Role == "Помогает" ? $"{m.FullName} (помогает)" : m.FullName)
            .ToList();

        // The average and the zones only over students whose week is filled in completely; attendance
        // over the days that are filled in — an empty day is not an absence.
        var full = scores.Where(s => s.Fill == CrmFill.Full).ToList();
        var attended = scores.Sum(s => s.Attended);
        var summary = new CrmPeriodSummaryDto(
            full.Count,
            full.Count == 0 ? null : Math.Round(full.Average(s => s.Total), 1),
            full.Count(s => s.Zone == "Pass"),
            full.Count(s => s.Zone == "Support"),
            full.Count(s => s.Zone == "Risk"),
            Percent(attended, attended + scores.Sum(s => s.Absent)),
            Percent(scores.Sum(s => s.FilledDays), scores.Sum(s => s.ExpectedDays)),
            scores.Count(s => s.Fill == CrmFill.Partial),
            scores.Count(s => s.Fill == CrmFill.Empty),
            scores.Sum(s => s.Issues.Count));

        return new CrmPeriodDto(
            period.Week,
            period.Label,
            closed,
            period.ExamMax,
            from,
            to,
            period.Days.Any(d => d.IsExam),
            teaching,
            summary,
            scores.Select(ToDto).ToList());
    }

    private CrmGroupDto ToDto(CrmGroup g) => new(
        g.Id,
        CrmJournalScoring.NormalizeName(g.Name),
        ToDto(g.Course),
        ToDto(g.Branch),
        g.Status.Name,
        g.ExamInterval.Id == 2,
        Local(g.StartsAt),
        Local(g.FinishedAt),
        g.EnrolledStudents,
        g.RequiredStudents,
        (g.Mentors ?? []).Where(m => m.Status.Id != CrmValues.MentorRemoved).Select(m => CrmJournalScoring.NormalizeName(m.FullName)).ToList());

    private static CrmRefDto ToDto(CrmRef r) => new(r.Id, r.Name.Trim());

    private static CrmStudentScoreDto ToDto(CrmStudentPeriodScore s) => new(
        s.StudentId, s.FullName, s.Total, s.AttendancePoints, s.HomeworkPoints, s.BonusPoints, s.ExamGrade,
        s.LessonsCounted, s.Attended, s.Absent, s.Fill, s.Zone, s.ExpectedDays, s.FilledDays,
        s.LateDays.Select(l => new CrmLateDto(l.Date, l.Minutes, l.Note)).ToList(),
        s.AbsentDays.Select(a => new CrmAbsenceDto(a.Date, a.Kind, a.Note)).ToList(),
        s.UnfilledDays,
        s.ZeroHomeworkDays,
        s.Issues.Select(i => new CrmIssueDto(i.Code, i.Message)).ToList(),
        s.Remarks.Select(r => new CrmRemarkDto(r.Date, r.Kind, r.Text, r.Author)).ToList());

    private static string RoleOf(int status) => status switch
    {
        CrmValues.MentorTeaching => "Ведёт",
        CrmValues.MentorSupport => "Помогает",
        _ => "Снят",
    };

    /// <summary>
    /// The CRM's timestamps are UTC; a group starting «11.07» is stored as 19:00 UTC on the 10th — the
    /// local midnight. The calendar day is therefore always taken in Dushanbe time.
    /// </summary>
    private DateOnly Local(DateTimeOffset value) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(value, _zone).DateTime);

    private static TimeZoneInfo ResolveZone(string id)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.CreateCustomTimeZone(id, TimeSpan.FromHours(5), id, id);
        }
    }

    private async Task<T> Cached<T>(string key, Func<Task<T>> load) where T : class
    {
        if (cache.TryGetValue(key, out T? hit) && hit is not null)
        {
            return hit;
        }

        var value = await load();
        cache.Set(key, value, CacheFor);
        return value;
    }

    private Task<T> Call<T>(Func<Task<T>> action) => CrmCall.RunAsync(client, logger, action);
}
