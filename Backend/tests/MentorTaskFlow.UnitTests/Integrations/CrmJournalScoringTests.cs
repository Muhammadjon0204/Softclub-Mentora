using MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

namespace MentorTaskFlow.UnitTests.Integrations;

/// <summary>The CRM's weekly score, and every oddity found in the real test journal.</summary>
public sealed class CrmJournalScoringTests
{
    private static readonly CrmRef Active = new(0, "Active");
    private static readonly CrmRef Inactive = new(1, "Inactive");

    private static DateTimeOffset Day(int day) => new(2026, 10, day, 0, 0, 0, TimeSpan.Zero);

    /// <summary>Mon–Fri lessons and a Saturday exam, 5–10 October 2026.</summary>
    private static CrmJournalPeriod Week(params CrmMark[] marks) => new(
        Week: 1,
        Label: "1",
        IsComplete: true,
        ExamMax: 70,
        Days: [.. Enumerable.Range(5, 5).Select(d => new CrmJournalDay(Day(d), false, false)), new CrmJournalDay(Day(10), true, false)],
        Students: [new CrmJournalStudent(7, "Фарзона  Каримова ", marks)]);

    private static CrmMark Mark(int day, bool attended = true, int grade = 0, int bonus = 0, int late = 0, CrmRef? status = null, params CrmNote[] notes) =>
        new(day, Day(day), status ?? Active, attended, late, grade, bonus, notes);

    private static CrmNote Note(int type, string text) => new(1, new CrmRef(type, "t"), text, "Ментор", Day(1));

    private static CrmStudentPeriodScore Score(CrmJournalPeriod period, DateOnly? joined = null) =>
        CrmJournalScoring.Score(period, period.Students[0], joined);

    [Fact]
    public void A_perfect_week_is_100_the_way_the_crm_counts_it()
    {
        // 5 lessons × (5 + 1 attendance) + exam 70 = 100.
        var score = Score(Week(Mark(5, grade: 5), Mark(6, grade: 5), Mark(7, grade: 5), Mark(8, grade: 5), Mark(9, grade: 5), Mark(10, grade: 70)));

        score.Total.ShouldBe(100);
        score.AttendancePoints.ShouldBe(5);
        score.HomeworkPoints.ShouldBe(25);
        score.ExamGrade.ShouldBe(70);
        score.Issues.ShouldBeEmpty();
        score.FullName.ShouldBe("Фарзона Каримова");
    }

    [Fact]
    public void The_exam_day_earns_no_attendance_point()
    {
        var score = Score(Week(Mark(10, grade: 50)));

        score.Total.ShouldBe(50);
        score.AttendancePoints.ShouldBe(0);
    }

    [Fact]
    public void Bonus_is_added()
    {
        Score(Week(Mark(5, grade: 4, bonus: 2))).Total.ShouldBe(4 + 2 + 1);
    }

    /// <summary>Agreed with the academy: lateness keeps the attendance point and is reported apart.</summary>
    [Fact]
    public void A_late_student_still_earns_the_attendance_point()
    {
        var score = Score(Week(Mark(6, grade: 5, late: 15, notes: Note(CrmValues.NoteLateness, "пробка"))));

        score.AttendancePoints.ShouldBe(1);
        score.LateDays.ShouldHaveSingleItem().ShouldBe(new CrmLateDay(new DateOnly(2026, 10, 6), 15, "пробка"));
    }

    /// <summary>«Отпросился» is an absence — no point — but reported as excused.</summary>
    [Fact]
    public void Absences_are_classified_by_their_note()
    {
        var score = Score(Week(
            Mark(5, attended: false, notes: Note(CrmValues.NoteExcused, "к врачу")),
            Mark(6, attended: false, notes: Note(CrmValues.NoteAbsence, "без причины")),
            Mark(7, attended: false)));

        score.AttendancePoints.ShouldBe(0);
        score.AbsentDays.Select(a => a.Kind).ShouldBe(["Excused", "Absence", "Unmarked"]);
    }

    [Fact]
    public void A_lesson_attended_with_zero_is_a_zero_homework_day()
    {
        var score = Score(Week(Mark(5, grade: 0), Mark(6, attended: false), Mark(7, grade: 3)));

        score.ZeroHomeworkDays.ShouldBe([new DateOnly(2026, 10, 5)]);
    }

    /// <summary>The CRM: an Inactive mark is a day that does not count — not an absence.</summary>
    [Fact]
    public void Inactive_marks_count_for_nothing()
    {
        var score = Score(Week(Mark(5, attended: false, status: Inactive), Mark(6, grade: 5)));

        score.Absent.ShouldBe(0);
        score.Total.ShouldBe(6);
        score.LessonsCounted.ShouldBe(1);
    }

    /// <summary>Seen on the test server: a mark dated with the time it was entered is still that day.</summary>
    [Fact]
    public void A_mark_with_a_time_of_day_belongs_to_its_date()
    {
        var mark = Mark(8, grade: 5) with { Date = new DateTimeOffset(2026, 10, 8, 11, 27, 37, TimeSpan.Zero) };

        var score = Score(Week(mark));

        score.Total.ShouldBe(6);
        score.Issues.ShouldNotContain(i => i.Code == "MarkOutsidePeriod");
    }

    /// <summary>Seen on the test server: 70, 90 and 95 entered on ordinary lesson days.</summary>
    [Fact]
    public void A_lesson_grade_above_five_is_flagged_not_hidden()
    {
        var score = Score(Week(Mark(5, grade: 95, bonus: 10)));

        score.Total.ShouldBe(106);
        score.Issues.Select(i => i.Code).ShouldBe(["LessonGradeOverFive", "MissingMarks", "TotalOver100"], ignoreOrder: true);
    }

    [Fact]
    public void An_exam_above_its_maximum_is_flagged()
    {
        Score(Week(Mark(10, grade: 80))).Issues.ShouldContain(i => i.Code == "ExamOverMax");
    }

    [Fact]
    public void A_hole_in_the_journal_is_reported()
    {
        var score = Score(Week(Mark(5, grade: 5), Mark(10, grade: 60)));

        score.Issues.ShouldContain(i => i.Code == "MissingMarks" && i.Message.Contains("06.10"));
    }

    /// <summary>Seen on the test server: active marks weeks before the student's own joining date.</summary>
    [Fact]
    public void A_mark_before_the_student_joined_is_flagged()
    {
        var score = Score(Week(Mark(5, grade: 5)), joined: new DateOnly(2026, 10, 8));

        score.Issues.ShouldContain(i => i.Code == "MarkBeforeJoined");
    }

    [Fact]
    public void A_grade_on_a_missed_day_is_flagged()
    {
        Score(Week(Mark(5, attended: false, grade: 4))).Issues.ShouldContain(i => i.Code == "GradeWhileAbsent");
    }
}
