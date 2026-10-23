using System.Text;
using MentorTaskFlow.Contracts.Integrations;
using MentorTaskFlow.Infrastructure.Reports;

namespace MentorTaskFlow.UnitTests.Integrations;

/// <summary>The report PDF renders — Cyrillic names, Markdown conclusions, a week with no previous one.</summary>
public sealed class CrmReportPdfTests
{
    private static CrmStudentScoreDto Student(int id, string name, int total, string zone) => new(
        id, name, total, 5, total - 5, 0, null, 5, 5, 0, "Full", zone, 6, 6, [], [], [], [], [], []);

    private static CrmPeriodDto Week(int week, params CrmStudentScoreDto[] students) => new(
        week, week.ToString(System.Globalization.CultureInfo.InvariantCulture), true, 70,
        new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 10), true, ["Мирзоев Мухаммаджон"],
        new CrmPeriodSummaryDto(students.Length, students.Average(s => s.Total), 1, 0, students.Length - 1, 90.5, 100, 0, 0, 0),
        students);

    [Fact]
    public void A_report_renders_to_a_pdf()
    {
        var model = new CrmReportPdfModel(
            "React - 1", "React", "6", new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 10), "Умед Шарипов",
            new DateTimeOffset(2026, 10, 11, 9, 0, 0, TimeSpan.Zero),
            Week(6, Student(1, "Али Замиров", 92, "Pass"), Student(2, "Салом Саломов", 41, "Risk")),
            Week(5, Student(1, "Али Замиров", 80, "Pass"), Student(2, "Салом Саломов", 55, "Risk")),
            "### Общая картина\nГруппа подросла: средний **66,5**.\n### Рекомендации\n1. Позвонить родителям.\n- Дать доп. задание.");

        var pdf = CrmReportPdf.Render(model);

        Encoding.ASCII.GetString(pdf, 0, 4).ShouldBe("%PDF");
        pdf.Length.ShouldBeGreaterThan(5_000);
        CrmReportPdf.FileName(model).ShouldBe("Otchet-React-1-Неделя-6.pdf");
    }

    [Fact]
    public void The_first_week_has_nothing_to_compare_with()
    {
        var model = new CrmReportPdfModel(
            "Kids", "Kids", "1-2", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 12), "Ментор", null,
            Week(1, Student(1, "Студент", 70, "Support")), null, string.Empty);

        Encoding.ASCII.GetString(CrmReportPdf.Render(model), 0, 4).ShouldBe("%PDF");
    }
}
