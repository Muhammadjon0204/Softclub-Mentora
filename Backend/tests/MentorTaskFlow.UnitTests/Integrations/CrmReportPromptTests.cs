using MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

namespace MentorTaskFlow.UnitTests.Integrations;

/// <summary>Names out of the AI prompt, names back in the answer — including the forms the model really writes.</summary>
public sealed class CrmReportPromptTests
{
    private static readonly string[] Names = ["Ali Zamirov", "Salom Salomov", "Osaf Abdulloev"];

    [Theory]
    [InlineData("Студент 1 набрал 100.", "Ali Zamirov набрал 100.")]
    [InlineData("Поговорить со Студентом 2.", "Поговорить со Salom Salomov.")]
    [InlineData("Студенту 3 нужна помощь", "Osaf Abdulloev нужна помощь")]
    [InlineData("- Студент 1 — 0 баллов, Студент 2 — 6 пропусков.", "- Ali Zamirov — 0 баллов, Salom Salomov — 6 пропусков.")]
    public void A_label_in_any_case_becomes_the_name(string answer, string expected) =>
        CrmReportPrompt.Restore(answer, Names).ShouldBe(expected);

    /// <summary>Seen with Gemini: «Связаться со Студентами 1–8».</summary>
    [Fact]
    public void A_range_becomes_the_list_of_names() =>
        CrmReportPrompt.Restore("Связаться со Студентами 1–3 сегодня.", Names)
            .ShouldBe("Связаться со Ali Zamirov, Salom Salomov, Osaf Abdulloev сегодня.");

    [Fact]
    public void A_number_outside_the_group_is_left_alone() =>
        CrmReportPrompt.Restore("Студент 9 и Студенты 2–9", Names).ShouldBe("Студент 9 и Студенты 2–9");

    /// <summary>A remark may carry a name the mentor typed — it leaves as a label.</summary>
    [Fact]
    public void A_name_typed_in_a_remark_is_replaced_by_the_label()
    {
        var labels = new List<(string, string)> { ("Ali Zamirov", "Студент 1"), ("Salom Salomov", "Студент 2") };

        CrmReportPrompt.Anonymize("Salomov опоздал, Ali Zamirov помог ему", labels)
            .ShouldBe("Студент 2 опоздал, Студент 1 помог ему");
    }
}
