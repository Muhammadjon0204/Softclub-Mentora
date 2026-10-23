using System.Globalization;
using System.Reflection;
using System.Text.RegularExpressions;
using MentorTaskFlow.Contracts.Integrations;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace MentorTaskFlow.Infrastructure.Reports;

/// <summary>What one report PDF is made of — the same figures the report page shows.</summary>
public sealed record CrmReportPdfModel(
    string GroupName,
    string CourseName,
    string PeriodLabel,
    DateOnly From,
    DateOnly To,
    string AuthorName,
    DateTimeOffset? SentAt,
    CrmPeriodDto Period,
    CrmPeriodDto? Previous,
    string Conclusions);

/// <summary>
/// The weekly CRM group report as an A4 PDF: the group's figures against last week, the students
/// ranked «было → стало», and the conclusions — for Telegram, email and «Скачать PDF».
/// </summary>
/// <remarks>
/// Noto Sans is embedded in the assembly: the Linux container has no font with Cyrillic, and a PDF
/// without one prints boxes instead of names.
/// </remarks>
public static class CrmReportPdf
{
    private const string Font = "Noto Sans";
    private const string Ink = "#111827";
    private const string Muted = "#6B7280";
    private const string Line = "#E5E7EB";
    private const string Soft = "#F8FAFC";
    private const string Green = "#15803D";
    private const string Amber = "#B45309";
    private const string Red = "#B91C1C";
    private const string Brand = "#4F46E5";

    private static readonly Lazy<bool> Setup = new(() =>
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var assembly = Assembly.GetExecutingAssembly();
        foreach (var name in new[] { "Mentora.Fonts.NotoSans-Regular.ttf", "Mentora.Fonts.NotoSans-Bold.ttf" })
        {
            using var stream = assembly.GetManifestResourceStream(name)
                               ?? throw new InvalidOperationException($"Шрифт {name} не встроен в сборку.");
            QuestPDF.Drawing.FontManager.RegisterFontFromStream(stream);
        }

        return true;
    });

    private static readonly CultureInfo Ru = CultureInfo.GetCultureInfo("ru-RU");

    public static string FileName(CrmReportPdfModel m)
    {
        var safe = Regex.Replace($"{m.GroupName} {PeriodTitle(m.PeriodLabel)}", @"[^\p{L}\p{N}]+", "-").Trim('-');
        return $"Otchet-{safe}.pdf";
    }

    public static byte[] Render(CrmReportPdfModel m) => Compose(m).GeneratePdf();

    /// <summary>The document itself — <see cref="Render"/> prints it to PDF; a preview can rasterize it instead.</summary>
    public static IDocument Compose(CrmReportPdfModel m)
    {
        _ = Setup.Value;

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(t => t.FontFamily(Font).FontSize(9.5f).FontColor(Ink).LineHeight(1.35f));

            page.Header().PaddingBottom(14).Column(header =>
            {
                header.Item().Text("ОТЧЁТ ПО ГРУППЕ").FontSize(8).FontColor(Brand).Bold().LetterSpacing(0.08f);
                header.Item().PaddingTop(2).Text($"{m.GroupName} · {PeriodTitle(m.PeriodLabel)}").FontSize(18).Bold();
                header.Item().PaddingTop(2).Text(text =>
                {
                    text.DefaultTextStyle(t => t.FontColor(Muted).FontSize(9.5f));
                    text.Span($"{m.CourseName} · {Day(m.From)} — {Day(m.To)} {m.To.Year}");
                    text.Span($"   ·   Ментор: {m.AuthorName}");
                    if (m.SentAt is { } sent)
                    {
                        text.Span($"   ·   Отправлен {sent.ToOffset(TimeSpan.FromHours(5)).ToString("d MMMM, HH:mm", Ru)}");
                    }
                });
                header.Item().PaddingTop(10).LineHorizontal(1).LineColor(Line);
            });

            page.Content().Column(content =>
            {
                content.Spacing(16);
                content.Item().Element(c => Kpis(c, m.Period, m.Previous));
                content.Item().Element(c => Ranking(c, m.Period, m.Previous));
                content.Item().Element(c => Conclusions(c, m.Conclusions));
            });

            page.Footer().PaddingTop(12).AlignCenter().Text(text =>
            {
                text.DefaultTextStyle(t => t.FontSize(8).FontColor(Muted));
                text.Span("Mentora · баллы посчитаны по журналу Omuz CRM · стр. ");
                text.CurrentPageNumber();
                text.Span(" из ");
                text.TotalPages();
            });
        }));
    }

    private static void Kpis(IContainer container, CrmPeriodDto period, CrmPeriodDto? previous)
    {
        var s = period.Summary;
        var p = previous?.Summary;

        container.Border(1).BorderColor(Line).Background(Soft).Row(row =>
        {
            void Cell(string label, Action<TextDescriptor> value, string? hint, bool first = false)
            {
                row.RelativeItem().BorderLeft(first ? 0 : 1).BorderColor(Line).Padding(10).Column(col =>
                {
                    col.Item().Text(label).FontSize(8).FontColor(Muted);
                    col.Item().PaddingTop(2).Text(value);
                    if (hint is not null)
                    {
                        col.Item().Text(hint).FontSize(8).FontColor(Muted);
                    }
                });
            }

            Cell("Средний балл группы", t =>
            {
                t.Span(Number(s.AverageTotal)).FontSize(17).Bold();
                Delta(t, s.AverageTotal, p?.AverageTotal, string.Empty);
            }, p is null ? "прошлой недели нет" : $"прошлая неделя: {Number(p.AverageTotal)}", first: true);

            Cell("80+ · 70–79 · ниже 70", t =>
            {
                t.Span(s.Passed.ToString(Ru)).FontSize(17).Bold().FontColor(Green);
                t.Span(" · ").FontSize(13).FontColor(Muted);
                t.Span(s.Support.ToString(Ru)).FontSize(17).Bold().FontColor(Amber);
                t.Span(" · ").FontSize(13).FontColor(Muted);
                t.Span(s.Risk.ToString(Ru)).FontSize(17).Bold().FontColor(Red);
            }, p is null ? null : $"было: {p.Passed} · {p.Support} · {p.Risk}");

            Cell("Посещаемость", t =>
            {
                t.Span(Percent(s.AttendanceRate)).FontSize(17).Bold();
                Delta(t, s.AttendanceRate, p?.AttendanceRate, "%");
            }, p is null ? null : $"прошлая неделя: {Percent(p.AttendanceRate)}");

            Cell("Студентов в отчёте", t => t.Span(s.Students.ToString(Ru)).FontSize(17).Bold(), null);
        });
    }

    private static void Ranking(IContainer container, CrmPeriodDto period, CrmPeriodDto? previous)
    {
        var before = (previous?.Students ?? []).Where(x => x.Fill == "Full").ToDictionary(x => x.StudentId, x => x.Total);
        var ranked = period.Students.Where(x => x.Fill != "Empty").OrderByDescending(x => x.Total).ToList();

        container.Column(col =>
        {
            col.Item().PaddingBottom(6).Text("УСПЕВАЕМОСТЬ СТУДЕНТОВ").FontSize(8).Bold().FontColor(Muted).LetterSpacing(0.06f);
            col.Item().Table(table =>
            {
                table.ColumnsDefinition(c =>
                {
                    c.ConstantColumn(30);
                    c.RelativeColumn(4);
                    c.RelativeColumn(1.1f);
                    c.RelativeColumn(1.1f);
                    c.RelativeColumn(1.1f);
                    c.RelativeColumn(2.2f);
                });

                table.Header(h =>
                {
                    foreach (var (title, right) in new[] { ("#", true), ("Студент", false), ("Было", true), ("Стало", true), ("±", true), ("Зона", false) })
                    {
                        var cell = h.Cell().Background(Soft).BorderBottom(1).BorderColor(Line).PaddingVertical(5).PaddingHorizontal(6);
                        (right ? cell.AlignRight() : cell).Text(title).FontSize(8).Bold().FontColor(Muted);
                    }
                });

                for (var i = 0; i < ranked.Count; i++)
                {
                    var st = ranked[i];
                    var full = st.Fill == "Full";
                    var (zoneText, zoneColor) = full ? Zone(st.Zone) : ("неделя не закрыта", Muted);
                    IContainer Cell() => table.Cell().BorderBottom(1).BorderColor(Line).PaddingVertical(5).PaddingHorizontal(6);

                    Cell().AlignRight().Text((i + 1).ToString(Ru)).FontColor(Muted);
                    Cell().Text(st.FullName).SemiBold();
                    Cell().AlignRight().Text(before.TryGetValue(st.StudentId, out var was) ? was.ToString(Ru) : "—").FontColor(Muted);
                    Cell().AlignRight().Text(st.Total.ToString(Ru)).Bold().FontColor(full ? zoneColor : Muted);
                    Cell().AlignRight().Text(t =>
                    {
                        if (before.TryGetValue(st.StudentId, out var prev))
                        {
                            var diff = st.Total - prev;
                            // Noto Sans has no ▲▼: the sign and the colour carry the direction.
                            t.Span(diff switch { > 0 => $"+{diff}", < 0 => $"−{-diff}", _ => "=" })
                                .FontColor(diff > 0 ? Green : diff < 0 ? Red : Muted).SemiBold();
                        }
                        else
                        {
                            t.Span("—").FontColor(Muted);
                        }
                    });
                    Cell().Text(zoneText).FontColor(zoneColor).FontSize(8.5f);
                }
            });
        });
    }

    private static void Conclusions(IContainer container, string conclusions)
    {
        container.Column(col =>
        {
            col.Item().PaddingBottom(6).Text("ВЫВОДЫ И РЕКОМЕНДАЦИИ").FontSize(8).Bold().FontColor(Muted).LetterSpacing(0.06f);

            if (string.IsNullOrWhiteSpace(conclusions))
            {
                col.Item().Text("Выводов нет.").FontColor(Muted);
                return;
            }

            foreach (var raw in conclusions.Split('\n'))
            {
                var line = raw.Trim();
                if (line.Length == 0)
                {
                    continue;
                }

                if (Regex.Match(line, @"^#{1,6}\s+(.*)$") is { Success: true } heading)
                {
                    col.Item().PaddingTop(6).Text(Strip(heading.Groups[1].Value)).FontSize(11).Bold();
                }
                else if (Regex.Match(line, @"^([-*•]|\d+[.)])\s+(.*)$") is { Success: true } bullet)
                {
                    var mark = char.IsDigit(bullet.Groups[1].Value[0]) ? bullet.Groups[1].Value : "•";
                    col.Item().PaddingLeft(8).PaddingTop(2).Row(row =>
                    {
                        row.ConstantItem(16).Text(mark).FontColor(Muted);
                        row.RelativeItem().Text(t => Inline(t, bullet.Groups[2].Value));
                    });
                }
                else
                {
                    col.Item().PaddingTop(3).Text(t => Inline(t, line));
                }
            }
        });
    }

    /// <summary>**жирный** inside a line, as on the report page.</summary>
    private static void Inline(TextDescriptor text, string line)
    {
        foreach (var part in Regex.Split(line, @"(\*\*[^*]+\*\*)").Where(p => p.Length > 0))
        {
            if (part.StartsWith("**", StringComparison.Ordinal) && part.EndsWith("**", StringComparison.Ordinal))
            {
                text.Span(part[2..^2]).Bold();
            }
            else
            {
                text.Span(part);
            }
        }
    }

    private static void Delta(TextDescriptor text, double? now, double? before, string suffix)
    {
        if (now is not { } n || before is not { } b)
        {
            return;
        }

        var diff = Math.Round(n - b, 1);
        var label = diff switch
        {
            > 0 => $"  +{diff.ToString(Ru)}{suffix}",
            < 0 => $"  −{Math.Abs(diff).ToString(Ru)}{suffix}",
            _ => "  =",
        };
        text.Span(label).FontSize(9).SemiBold().FontColor(diff > 0 ? Green : diff < 0 ? Red : Muted);
    }

    private static (string Text, string Color) Zone(string zone) => zone switch
    {
        "Pass" => ("проходит", Green),
        "Support" => ("нужна поддержка", Amber),
        _ => ("зона риска", Red),
    };

    private static string Strip(string text) => text.Replace("**", string.Empty, StringComparison.Ordinal);

    private static string Number(double? value) => value?.ToString("0.#", Ru) ?? "—";

    private static string Percent(double? value) => value is { } v ? $"{v.ToString("0.#", Ru)}%" : "—";

    private static string Day(DateOnly day) => day.ToString("d MMM", Ru).TrimEnd('.');

    public static string PeriodTitle(string label) =>
        label.Contains('-') ? $"Недели {label.Replace('-', '–')}" : $"Неделя {label}";
}
