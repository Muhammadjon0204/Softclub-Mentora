namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>A lateness: the day, the minutes and the mentor's note if there is one.</summary>
public sealed record CrmLateDay(DateOnly Date, int Minutes, string? Note);

/// <summary>A missed day. <c>Kind</c>: <c>Absence</c>, <c>Excused</c> («отпросился») or <c>Unmarked</c> (no note).</summary>
public sealed record CrmAbsentDay(DateOnly Date, string Kind, string? Note);

/// <summary>Something in the data that does not fit the CRM's own rules — shown, never silently fixed.</summary>
public sealed record CrmDataIssue(string Code, string Message);

/// <summary>One student in one journal period, computed the way the CRM computes it.</summary>
public sealed record CrmStudentPeriodScore(
    int StudentId,
    string FullName,
    int Total,
    int AttendancePoints,
    int HomeworkPoints,
    int BonusPoints,
    int? ExamGrade,
    bool? ExamAttended,
    int LessonsCounted,
    int Attended,
    int Absent,
    IReadOnlyList<CrmLateDay> LateDays,
    IReadOnlyList<CrmAbsentDay> AbsentDays,
    IReadOnlyList<DateOnly> ZeroHomeworkDays,
    IReadOnlyList<CrmDataIssue> Issues)
{
    /// <summary>The pass mark of the academy: 80 of 100.</summary>
    public const int PassMark = 80;
}

/// <summary>
/// The CRM's weekly score, computed from the raw marks of one journal period.
/// </summary>
/// <remarks>
/// <para>
/// The rule is the one the CRM documents and shows on its screen: for every mark with status
/// <c>Active</c>, <c>grade + bonus</c>, plus one attendance point on a lesson day (not on the exam).
/// Agreed with the academy: a late student still earns the attendance point (the lateness is reported
/// separately); «отпросился» is an absence. A total above 100 is reported as it is — the CRM is the
/// source of truth and the overflow is flagged, not capped.
/// </para>
/// <para>
/// Marks are matched to days by calendar date only: the CRM stores days at midnight UTC, but some marks
/// carry the time they were entered (<c>…T11:27:37</c>), and that time is not a different day.
/// </para>
/// </remarks>
public static class CrmJournalScoring
{
    public static DateOnly DateOf(DateTimeOffset value) => DateOnly.FromDateTime(value.UtcDateTime);

    public static CrmStudentPeriodScore Score(CrmJournalPeriod period, CrmJournalStudent student, DateOnly? joinedOn = null)
    {
        var days = period.Days
            .GroupBy(d => DateOf(d.Date))
            .ToDictionary(g => g.Key, g => g.First());

        int attendance = 0, homework = 0, bonus = 0, lessons = 0, attended = 0, absent = 0;
        int? exam = null;
        bool? examAttended = null;
        var late = new List<CrmLateDay>();
        var absences = new List<CrmAbsentDay>();
        var zeroHomework = new List<DateOnly>();
        var issues = new List<CrmDataIssue>();
        var markedDays = new HashSet<DateOnly>();
        var beforeJoined = new List<DateOnly>();

        foreach (var mark in student.Marks.OrderBy(m => m.Date))
        {
            var date = DateOf(mark.Date);

            if (!markedDays.Add(date))
            {
                issues.Add(new("DuplicateMark", $"{date:dd.MM}: две отметки за один день — учтена каждая."));
            }

            if (mark.Status.Id != CrmValues.MarkActive)
            {
                continue;
            }

            if (!days.TryGetValue(date, out var day))
            {
                issues.Add(new("MarkOutsidePeriod", $"{date:dd.MM}: отметка на день, которого нет в периоде."));
                continue;
            }

            if (joinedOn is { } joined && date < joined)
            {
                beforeJoined.Add(date);
            }

            var notes = mark.Notes ?? [];
            var note = notes.FirstOrDefault()?.Content;
            bonus += mark.Bonus;

            if (mark.Grade < 0 || mark.Bonus < 0)
            {
                issues.Add(new("NegativeValue", $"{date:dd.MM}: отрицательная оценка или бонус."));
            }

            if (day.IsExam)
            {
                exam = (exam ?? 0) + mark.Grade;
                examAttended = mark.IsAttended;

                if (mark.Grade > period.ExamMax)
                {
                    issues.Add(new("ExamOverMax", $"{date:dd.MM}: экзамен {mark.Grade} при максимуме {period.ExamMax}."));
                }
            }
            else
            {
                lessons++;
                homework += mark.Grade;

                if (mark.Grade > 5)
                {
                    issues.Add(new("LessonGradeOverFive", $"{date:dd.MM}: оценка за урок {mark.Grade} при максимуме 5."));
                }

                if (mark.IsAttended)
                {
                    attendance++;
                    if (mark.Grade == 0)
                    {
                        zeroHomework.Add(date);
                    }
                }
            }

            if (mark.IsAttended)
            {
                attended++;
                var lateNote = notes.FirstOrDefault(n => n.Type.Id == CrmValues.NoteLateness);
                if (mark.LateMinutes > 0 || lateNote is not null)
                {
                    late.Add(new(date, mark.LateMinutes, lateNote?.Content ?? note));
                }
            }
            else
            {
                absent++;
                var kind = notes.Any(n => n.Type.Id == CrmValues.NoteExcused) ? "Excused"
                    : notes.Any(n => n.Type.Id == CrmValues.NoteAbsence) ? "Absence"
                    : "Unmarked";
                absences.Add(new(date, kind, note));

                if (mark.Grade > 0)
                {
                    issues.Add(new("GradeWhileAbsent", $"{date:dd.MM}: оценка {mark.Grade} при отметке «не был»."));
                }
            }
        }

        if (beforeJoined.Count > 0)
        {
            issues.Add(new(
                "MarkBeforeJoined",
                $"Отметки раньше, чем студент пришёл в группу ({joinedOn:dd.MM}): {string.Join(", ", beforeJoined.Select(d => d.ToString("dd.MM")))}."));
        }

        // A day of the period the student has no mark for at all: neither attended nor absent in the
        // CRM's eyes, so it earns nothing — but the mentor should know the journal has a hole.
        var activeDays = days.Where(d => !d.Value.IsDayOff).Select(d => d.Key).ToList();
        var missing = activeDays.Where(d => !markedDays.Contains(d) && (joinedOn is null || d >= joinedOn)).ToList();
        if (missing.Count > 0 && markedDays.Count > 0)
        {
            issues.Add(new("MissingMarks", $"Нет отметки за {missing.Count} дн.: {string.Join(", ", missing.Select(d => d.ToString("dd.MM")))}."));
        }

        var total = attendance + homework + bonus + (exam ?? 0);
        if (total > 100)
        {
            issues.Add(new("TotalOver100", $"Итог {total} больше 100."));
        }

        return new CrmStudentPeriodScore(
            student.Id,
            NormalizeName(student.FullName),
            total,
            attendance,
            homework,
            bonus,
            exam,
            examAttended,
            lessons,
            attended,
            absent,
            late,
            absences,
            zeroHomework,
            issues);
    }

    /// <summary>The CRM keeps names as typed: «Hakim  Jumaev » — collapse the spaces.</summary>
    public static string NormalizeName(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries));
}
