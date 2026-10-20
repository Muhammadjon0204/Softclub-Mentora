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

    public Task<CrmGroupListDto> ListGroupsAsync(string status, CancellationToken cancellationToken)
    {
        if (!StatusIds.TryGetValue(status, out var statusId))
        {
            throw new ValidationAppException("status", "Статус группы: Preparing, Started или Finished.");
        }

        return Cached($"crm:groups:{statusId}", async () =>
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
    }

    private Task<Dictionary<int, IReadOnlyList<string>>> CurrentMentorsAsync(CancellationToken cancellationToken) =>
        Cached("crm:mentors:current", async () =>
        {
            var mentors = await Call(() => client.ListMentorsAsync(cancellationToken));
            return mentors
                .SelectMany(m => (m.Groups ?? [])
                    .Where(g => g.IsCurrent && g.MentorStatus.Id != CrmValues.MentorRemoved)
                    .Select(g => (GroupId: g.Id, Name: CrmJournalScoring.NormalizeName($"{m.Name} {m.Surname}") + (g.MentorStatus.Id == CrmValues.MentorSupport ? " (помогает)" : ""))))
                .GroupBy(x => x.GroupId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.Name).ToList());
        });

    public Task<CrmGroupPreviewDto> GetGroupPreviewAsync(int groupId, CancellationToken cancellationToken) =>
        Cached($"crm:group:{groupId}", async () =>
        {
            var group = await Call(() => client.GetGroupAsync(groupId, cancellationToken))
                        ?? throw new NotFoundException("Группа в CRM не найдена.");
            var journal = await Call(() => client.GetJournalAsync(groupId, cancellationToken));

            var mentors = (group.Mentors ?? [])
                .OrderBy(m => m.StartedAt)
                .Select(m => new CrmGroupMentorDto(m.Id, CrmJournalScoring.NormalizeName(m.FullName), RoleOf(m.Status.Id), Local(m.StartedAt), m.EndedAt is { } e ? Local(e) : null))
                .ToList();

            var joined = (group.Students ?? []).ToDictionary(s => s.Id, s => Local(s.JoinedAt));
            var students = (group.Students ?? [])
                .Select(s => new CrmGroupStudentDto(
                    s.Id,
                    CrmJournalScoring.NormalizeName($"{s.FirstName} {s.LastName}"),
                    s.Status.Name,
                    Local(s.JoinedAt),
                    s.LeftAt is { } left ? Local(left) : null,
                    string.IsNullOrWhiteSpace(s.Note) ? null : s.Note.Trim()))
                .ToList();

            var periods = (journal ?? [])
                .OrderByDescending(p => p.Week)
                .Select(p => ToPeriod(p, mentors, joined))
                .ToList();

            return new CrmGroupPreviewDto(
                ToDto(group),
                mentors,
                students,
                periods,
                journal is null ? "У группы нет расписания — журнала в CRM нет." : null);
        });

    private CrmPeriodDto ToPeriod(CrmJournalPeriod period, IReadOnlyList<CrmGroupMentorDto> mentors, IReadOnlyDictionary<int, DateOnly> joined)
    {
        var dates = period.Days.Select(d => CrmJournalScoring.DateOf(d.Date)).ToList();
        var from = dates.Count > 0 ? dates.Min() : default;
        var to = dates.Count > 0 ? dates.Max() : default;

        var scores = period.Students
            .Select(s => CrmJournalScoring.Score(period, s, joined.TryGetValue(s.Id, out var j) ? j : null))

            // A student with no counted day in the period was not in the group yet (or any more).
            .Where(s => s.LessonsCounted > 0 || s.ExamGrade is not null)
            .OrderByDescending(s => s.Total)
            .ToList();

        var teaching = mentors
            .Where(m => m.From <= to && (m.To is null || m.To >= from))
            .Select(m => m.Role == "Помогает" ? $"{m.FullName} (помогает)" : m.FullName)
            .ToList();

        var lessonMarks = scores.Sum(s => s.LessonsCounted);
        var summary = new CrmPeriodSummaryDto(
            scores.Count,
            scores.Count == 0 ? null : Math.Round(scores.Average(s => s.Total), 1),
            scores.Count(s => s.Total >= CrmStudentPeriodScore.PassMark),
            lessonMarks == 0 ? null : Math.Round(100.0 * scores.Sum(s => s.AttendancePoints) / lessonMarks, 1),
            scores.Sum(s => s.Issues.Count));

        return new CrmPeriodDto(
            period.Week,
            period.Label,
            period.IsComplete,
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
        s.LessonsCounted, s.Attended, s.Absent,
        s.LateDays.Select(l => new CrmLateDto(l.Date, l.Minutes, l.Note)).ToList(),
        s.AbsentDays.Select(a => new CrmAbsenceDto(a.Date, a.Kind, a.Note)).ToList(),
        s.ZeroHomeworkDays,
        s.Issues.Select(i => new CrmIssueDto(i.Code, i.Message)).ToList());

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

    /// <summary>Turns the client's failures into the API's: 503 with a reason the admin can act on.</summary>
    private async Task<T> Call<T>(Func<Task<T>> action)
    {
        if (!client.IsConfigured)
        {
            throw new ServiceUnavailableException(ErrorCodes.IntegrationNotConfigured, "Интеграция с CRM не настроена: нет ключа API.");
        }

        try
        {
            return await action();
        }
        catch (CrmUnauthorizedException exception)
        {
            throw new ServiceUnavailableException(ErrorCodes.IntegrationUnavailable, $"CRM не принимает ключ: {exception.Message}");
        }
        catch (Exception exception) when (exception is CrmUnavailableException or CrmRequestException)
        {
            logger.LogWarning(exception, "CRM call failed.");
            throw new ServiceUnavailableException(ErrorCodes.IntegrationUnavailable, exception.Message);
        }
    }
}
