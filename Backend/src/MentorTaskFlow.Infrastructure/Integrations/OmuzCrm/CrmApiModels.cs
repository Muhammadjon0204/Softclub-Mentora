namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

// The wire format of Omuz CRM `integration/v1`, as documented in INTEGRATION_API.md (19.10.2026) and
// checked against the test server. Kept separate from Mentora's own contracts: if the CRM changes, only
// this file and the mapping in CrmIntegrationService move.

/// <summary>Every response: <c>{ data, statusCode, errors }</c>; lists add the page fields.</summary>
public sealed record CrmEnvelope<T>(
    T? Data,
    int StatusCode,
    IReadOnlyList<string>? Errors,
    int? PageNumber = null,
    int? PageSize = null,
    int? TotalPages = null,
    int? TotalRecords = null);

/// <summary>A value from a CRM list or a reference to another entity: <c>{ id, name }</c>.</summary>
public sealed record CrmRef(int Id, string Name);

public sealed record CrmPing(string KeyName, DateTimeOffset ServerTime);

public sealed record CrmMentor(
    int Id,
    string? Name,
    string? Surname,
    string? MiddleName,
    string? PhoneNumber,
    string? Email,
    string? TelegramUsername,
    DateTimeOffset? RegisteredDate,
    int? Experience,
    CrmRef Status,
    CrmRef? Branch,
    IReadOnlyList<CrmRef>? Positions,
    IReadOnlyList<CrmMentorGroup>? Groups);

public sealed record CrmMentorGroup(
    int Id,
    string Name,
    CrmRef? Branch,
    CrmRef Status,
    CrmRef MentorStatus,
    DateTimeOffset StartDate,
    DateTimeOffset? EndDate,
    bool IsCurrent);

public sealed record CrmTimeTable(CrmRef DayOfWeek, string FromTime, string ToTime, CrmRef Type);

public sealed record CrmGroup(
    int Id,
    string Name,
    CrmRef Course,
    CrmRef Branch,
    CrmRef Status,
    CrmRef ExamInterval,
    DateTimeOffset StartsAt,
    DateTimeOffset FinishedAt,
    int DurationMonths,
    int RequiredStudents,
    int EnrolledStudents,
    IReadOnlyList<CrmTimeTable>? TimeTables,
    IReadOnlyList<CrmGroupMentor>? Mentors = null,
    IReadOnlyList<CrmGroupStudent>? Students = null);

/// <summary>Every mentor the group ever had: <c>endedAt</c> is the removal date or the group's end.</summary>
public sealed record CrmGroupMentor(int Id, string FullName, DateTimeOffset StartedAt, DateTimeOffset? EndedAt, CrmRef Status);

public sealed record CrmGroupStudent(
    int Id,
    string? FirstName,
    string? LastName,
    CrmRef Status,
    string? Note,
    DateTimeOffset JoinedAt,
    DateTimeOffset? LeftAt);

/// <summary>One journal period: a week, or two weeks in a BiWeekly (kids) group. Newest first.</summary>
public sealed record CrmJournalPeriod(
    int Week,
    string Label,
    bool IsComplete,
    int ExamMax,
    IReadOnlyList<CrmJournalDay> Days,
    IReadOnlyList<CrmJournalStudent> Students);

public sealed record CrmJournalDay(DateTimeOffset Date, bool IsExam, bool IsDayOff);

public sealed record CrmJournalStudent(int Id, string FullName, IReadOnlyList<CrmMark> Marks);

public sealed record CrmMark(
    long Id,
    DateTimeOffset Date,
    CrmRef Status,
    bool IsAttended,
    int LateMinutes,
    int Grade,
    int Bonus,
    IReadOnlyList<CrmNote>? Notes);

public sealed record CrmNote(long Id, CrmRef Type, string? Content, string? AuthorName, DateTimeOffset CreatedAt);

/// <summary>The numeric values of section 6 of the CRM documentation.</summary>
public static class CrmValues
{
    public const int GroupPreparing = 0;
    public const int GroupStarted = 1;
    public const int GroupFinished = 2;

    public const int MarkActive = 0;

    public const int MentorTeaching = 0;
    public const int MentorRemoved = 1;
    public const int MentorSupport = 2;

    public const int NoteOther = 1;
    public const int NoteAbsence = 5;
    public const int NoteLateness = 6;
    public const int NoteExcused = 8;
}
