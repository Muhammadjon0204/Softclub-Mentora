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
    bool HasData,
    IReadOnlyList<CrmLateDto> LateDays,
    IReadOnlyList<CrmAbsenceDto> AbsentDays,
    IReadOnlyList<DateOnly> UnfilledDays,
    IReadOnlyList<DateOnly> ZeroHomeworkDays,
    IReadOnlyList<CrmIssueDto> Issues);

/// <summary>
/// A period at a glance. <c>Students</c>, the average, <c>Passed</c> and the attendance count only what
/// the mentor filled in; <c>UnfilledDays</c> — student-days not filled in, <c>EmptyStudents</c> — students
/// with nothing filled in for the whole period.
/// </summary>
public sealed record CrmPeriodSummaryDto(
    int Students,
    double? AverageTotal,
    int Passed,
    double? AttendanceRate,
    int UnfilledDays,
    int EmptyStudents,
    int IssueCount);

/// <summary>A student over the closed periods: the average of the weekly totals, never their sum.</summary>
public sealed record CrmStudentOverallDto(
    int StudentId,
    string FullName,
    double AverageTotal,
    int Weeks,
    int MinTotal,
    int MaxTotal,
    int Attended,
    int Absent,
    int Late,
    int UnfilledDays);

/// <summary>The group over its closed periods: the average of its students' averages.</summary>
public sealed record CrmOverallDto(
    int Periods,
    int Students,
    double? AverageTotal,
    int Passed,
    double? AttendanceRate,
    int UnfilledDays,
    IReadOnlyList<CrmStudentOverallDto> StudentResults);

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
    CrmOverallDto Overall,
    string? JournalUnavailable);
