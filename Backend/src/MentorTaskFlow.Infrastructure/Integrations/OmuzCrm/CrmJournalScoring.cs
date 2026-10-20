namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>A lateness: the day, the minutes and the mentor's note if there is one.</summary>
public sealed record CrmLateDay(DateOnly Date, int Minutes, string? Note);

/// <summary>
/// A missed day: a past day without the attendance tick. <c>Kind</c> is the reason the mentor gave —
/// <c>Absence</c> («пропуск»), <c>Excused</c> («отпросился»), <c>Other</c> («другое») — or
/// <c>NoReason</c> (no note), or <c>NoMark</c> (the CRM has no mark for the day at all).
/// </summary>
public sealed record CrmAbsentDay(DateOnly Date, string Kind, string? Note);

/// <summary>
/// A mentor's remark that is not about attendance: <c>CultureViolation</c>, <c>Cheating</c>,
/// <c>BadBehavior</c>, or <c>Other</c> on a day the student was there.
/// </summary>
public sealed record CrmRemark(DateOnly Date, string Kind, string Text, string? Author);

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
    IReadOnlyList<DateOnly> UnfilledDays,
    IReadOnlyList<DateOnly> ZeroHomeworkDays,
    IReadOnlyList<CrmDataIssue> Issues,
    int ExpectedDays,
    int FilledDays,
    IReadOnlyList<CrmRemark> Remarks)
{
    /// <summary>The pass mark of the academy: 80 of 100.</summary>
    public const int PassMark = 80;

    /// <summary>From 70 to 79 the student passes but needs a push; below 70 is the risk zone.</summary>
    public const int SupportMark = 70;

    /// <summary>
    /// How much of the week the mentor filled in, counting only the days the student was in the group:
    /// <c>Full</c>, <c>Partial</c> or <c>Empty</c>. Only a full week is a real result — a week with
    /// two days filled in of six is a total of a third of a week, not a bad student.
    /// </summary>
    public string Fill => ExpectedDays > 0 && FilledDays >= ExpectedDays ? CrmFill.Full : FilledDays > 0 ? CrmFill.Partial : CrmFill.Empty;

    public string Zone => CrmJournalScoring.ZoneOf(Total);
}

public static class CrmFill
{
    public const string Full = "Full";
    public const string Partial = "Partial";
    public const string Empty = "Empty";
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
/// The attendance tick is set for every student on the day of the lesson — the academy's
/// administration makes sure of it. So a day that has passed without the tick is an absence, with or
/// without a note; the note («пропуск», «отпросился», «другое») only gives the reason. Only today's
/// and later days can still be «not marked yet». A past day the CRM has no mark for at all counts as
/// an absence too (it earns nothing in the CRM either) and is flagged as a hole in the journal.
/// </para>
/// <para>
/// The weeks themselves come from the CRM: it lays the calendar out as six lesson days ending with
/// the exam, then a day off, and moves the days around holidays. A student is expected only on the
/// days between joining and leaving the group.
/// </para>
/// <para>
/// Marks are matched to days by calendar date only: the CRM stores days at midnight UTC, but some marks
/// carry the time they were entered (<c>…T11:27:37</c>), and that time is not a different day.
/// </para>
/// </remarks>
public static class CrmJournalScoring
{
    public static DateOnly DateOf(DateTimeOffset value) => DateOnly.FromDateTime(value.UtcDateTime);

    /// <summary><c>Pass</c> (80+), <c>Support</c> (70–79) or <c>Risk</c> (below 70).</summary>
    public static string ZoneOf(double total) =>
        total >= CrmStudentPeriodScore.PassMark ? "Pass" : total >= CrmStudentPeriodScore.SupportMark ? "Support" : "Risk";

    /// <param name="today">The current day in Dushanbe: it and later days may not be marked yet. <c>null</c> — every day has passed.</param>
    public static CrmStudentPeriodScore Score(
        CrmJournalPeriod period,
        CrmJournalStudent student,
        DateOnly? joinedOn = null,
        DateOnly? leftOn = null,
        DateOnly? today = null)
    {
        bool Passed(DateOnly date) => today is null || date < today;
        var days = period.Days
            .GroupBy(d => DateOf(d.Date))
            .ToDictionary(g => g.Key, g => g.First());

        int attendance = 0, homework = 0, bonus = 0, lessons = 0, attended = 0, absent = 0;
        int? exam = null;
        bool? examAttended = null;
        var late = new List<CrmLateDay>();
        var absences = new List<CrmAbsentDay>();
        var filledDays = new HashSet<DateOnly>();
        var remarks = new List<CrmRemark>();
        var zeroHomework = new List<DateOnly>();
        var issues = new List<CrmDataIssue>();
        var markedDays = new HashSet<DateOnly>();
        var inactiveDays = new HashSet<DateOnly>();
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
                inactiveDays.Add(date);
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
            bonus += mark.Bonus;

            // Several people may write on one day (the test journal has whole conversations): keep
            // every distinct text of the kind that matters.
            string? NotesOf(params int[] types) => Join(notes.Where(n => types.Contains(n.Type.Id)));

            foreach (var remark in notes.Where(n => RemarkKinds.ContainsKey(n.Type.Id) || (n.Type.Id == CrmValues.NoteOther && mark.IsAttended)))
            {
                if (!string.IsNullOrWhiteSpace(remark.Content))
                {
                    remarks.Add(new(date, remark.Type.Id == CrmValues.NoteOther ? "Other" : RemarkKinds[remark.Type.Id], remark.Content.Trim(), remark.AuthorName));
                }
            }

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
                filledDays.Add(date);
                if (mark.LateMinutes > 0 || notes.Any(n => n.Type.Id == CrmValues.NoteLateness))
                {
                    late.Add(new(date, mark.LateMinutes, NotesOf(CrmValues.NoteLateness)));
                }
            }
            else
            {
                var kind = notes.Any(n => n.Type.Id == CrmValues.NoteExcused) ? "Excused"
                    : notes.Any(n => n.Type.Id == CrmValues.NoteAbsence) ? "Absence"
                    : notes.Any(n => n.Type.Id == CrmValues.NoteOther) ? "Other"
                    : Passed(date) ? "NoReason"
                    : null;
                var note = NotesOf(CrmValues.NoteExcused, CrmValues.NoteAbsence, CrmValues.NoteOther);

                // No tick on today's lesson: it may simply not be marked yet.
                if (kind is not null)
                {
                    absent++;
                    filledDays.Add(date);
                    absences.Add(new(date, kind, note));
                    if (mark.Grade > 0)
                    {
                        issues.Add(new("GradeWhileAbsent", $"{date:dd.MM}: оценка {mark.Grade}, а галочки «был» нет — балл за посещение не начислен."));
                    }
                }
            }
        }

        if (beforeJoined.Count > 0)
        {
            issues.Add(new(
                "MarkBeforeJoined",
                $"Отметки раньше, чем студент пришёл в группу ({joinedOn:dd.MM}): {string.Join(", ", beforeJoined.Select(d => d.ToString("dd.MM")))}."));
        }

        // The days the student was in the group. A past one with no mark at all is a hole in the CRM's
        // journal: no tick, so an absence, but flagged. What is left unmarked is today or later.
        var memberDays = days
            .Where(d => !d.Value.IsDayOff && !inactiveDays.Contains(d.Key) && (joinedOn is null || d.Key >= joinedOn) && (leftOn is null || d.Key <= leftOn))
            .Select(d => d.Key)
            .Order()
            .ToList();
        var holes = memberDays.Where(d => !markedDays.Contains(d) && Passed(d)).ToList();
        foreach (var hole in holes)
        {
            absent++;
            filledDays.Add(hole);
            absences.Add(new(hole, "NoMark", null));
        }

        if (holes.Count > 0)
        {
            issues.Add(new("MissingMarks", $"В CRM нет отметки за {holes.Count} дн.: {string.Join(", ", holes.Select(d => d.ToString("dd.MM")))} — считаем как «не был»."));
        }

        var unfilled = memberDays.Where(d => !filledDays.Contains(d)).ToList();

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
            absences.OrderBy(a => a.Date).ToList(),
            unfilled,
            zeroHomework,
            issues,
            memberDays.Count,
            memberDays.Count - unfilled.Count,
            remarks);
    }

    private static readonly Dictionary<int, string> RemarkKinds = new()
    {
        [CrmValues.NoteCultureViolation] = "CultureViolation",
        [CrmValues.NoteCheating] = "Cheating",
        [CrmValues.NoteBadBehavior] = "BadBehavior",
    };

    private static string? Join(IEnumerable<CrmNote> notes)
    {
        var texts = notes.Select(n => n.Content?.Trim()).Where(t => !string.IsNullOrEmpty(t)).Distinct().ToList();
        return texts.Count == 0 ? null : string.Join(" · ", texts);
    }

    /// <summary>The CRM keeps names as typed: «Hakim  Jumaev » — collapse the spaces.</summary>
    public static string NormalizeName(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries));
}
