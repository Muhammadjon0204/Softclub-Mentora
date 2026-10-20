namespace MentorTaskFlow.Contracts.Integrations;

/// <summary><c>GET /integrations/crm/status</c> — whether the CRM answers, and as whom.</summary>
public sealed record CrmStatusDto(
    bool Configured,
    bool Connected,
    string BaseUrl,
    string? KeyName,
    DateTimeOffset? ServerTime,
    int? LatencyMs,
    string? Error,
    IReadOnlyList<CrmRefDto> Branches,
    IReadOnlyList<CrmRefDto> Courses);

public sealed record CrmRefDto(int Id, string Name);

/// <summary>A CRM group as Mentora shows it. Dates are calendar days in Dushanbe.</summary>
public sealed record CrmGroupDto(
    int Id,
    string Name,
    CrmRefDto Course,
    CrmRefDto Branch,
    string Status,
    bool BiWeekly,
    DateOnly StartsOn,
    DateOnly FinishesOn,
    int EnrolledStudents,
    int RequiredStudents,
    IReadOnlyList<string> CurrentMentors);

/// <summary><c>GET /integrations/crm/groups?status=</c>.</summary>
public sealed record CrmGroupListDto(IReadOnlyList<CrmGroupDto> Groups);

public sealed record CrmGroupMentorDto(int Id, string FullName, string Role, DateOnly From, DateOnly? To);

public sealed record CrmGroupStudentDto(int Id, string FullName, string Status, DateOnly JoinedOn, DateOnly? LeftOn, string? Note);

public sealed record CrmLateDto(DateOnly Date, int Minutes, string? Note);

public sealed record CrmAbsenceDto(DateOnly Date, string Kind, string? Note);

public sealed record CrmIssueDto(string Code, string Message);

/// <summary>One student in one period — the numbers a group report is built from.</summary>
public sealed record CrmStudentScoreDto(
    int StudentId,
    string FullName,
    int Total,
    int AttendancePoints,
    int HomeworkPoints,
    int BonusPoints,
    int? ExamGrade,
    int LessonsCounted,
    int Attended,
    int Absent,
    IReadOnlyList<CrmLateDto> LateDays,
    IReadOnlyList<CrmAbsenceDto> AbsentDays,
    IReadOnlyList<DateOnly> ZeroHomeworkDays,
    IReadOnlyList<CrmIssueDto> Issues);

public sealed record CrmPeriodSummaryDto(int Students, double? AverageTotal, int Passed, double? AttendanceRate, int IssueCount);

/// <summary>
/// A journal period: <c>Week</c> is the CRM's key, <c>Label</c> what to show («6», or «13-14» for a
/// two-week kids period). <c>Mentors</c> — who taught the group during it.
/// </summary>
public sealed record CrmPeriodDto(
    int Week,
    string Label,
    bool IsComplete,
    int ExamMax,
    DateOnly From,
    DateOnly To,
    bool HasExam,
    IReadOnlyList<string> Mentors,
    CrmPeriodSummaryDto Summary,
    IReadOnlyList<CrmStudentScoreDto> Students);

/// <summary><c>GET /integrations/crm/groups/{id}</c> — the group, its people and the scored journal.</summary>
public sealed record CrmGroupPreviewDto(
    CrmGroupDto Group,
    IReadOnlyList<CrmGroupMentorDto> Mentors,
    IReadOnlyList<CrmGroupStudentDto> Students,
    IReadOnlyList<CrmPeriodDto> Periods,
    string? JournalUnavailable);
