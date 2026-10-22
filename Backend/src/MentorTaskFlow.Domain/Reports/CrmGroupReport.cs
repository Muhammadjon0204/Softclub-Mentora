using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.Domain.Reports;

public enum CrmGroupReportStatus
{
    /// <summary>The mentor is still working on it; only they see it.</summary>
    Draft = 0,

    /// <summary>Sent to the Lead: read-only from now on.</summary>
    Sent = 1,
}

/// <summary>
/// A mentor's report on one CRM group for one journal period (a week, or two for a kids group).
/// </summary>
/// <remarks>
/// <para>
/// The figures are the CRM's, scored by Mentora, and are kept as they were when the report was made
/// (<see cref="SnapshotJson"/>): a Lead reads what the mentor reported, not whatever the journal says
/// later. <see cref="DataHash"/> is the fingerprint of those figures — when the journal is corrected
/// afterwards, the fingerprint no longer matches and the report is shown as «данные изменились».
/// </para>
/// <para>
/// One report per group and period, whoever writes it: a group with two mentors gets one report, and
/// the second mentor sees who already made it (<c>ux_crm_group_reports_group_week</c>).
/// </para>
/// </remarks>
public sealed class CrmGroupReport : AuditableEntity
{
    public const int NameMaxLength = 200;
    public const int LabelMaxLength = 16;
    public const int ConclusionsMaxLength = 20000;

    public Guid OrganizationId { get; private set; }

    /// <summary>The author's branch: the report lives where its author works.</summary>
    public Guid BranchId { get; private set; }

    /// <summary>The author's category — what makes it visible to the category's Lead.</summary>
    public Guid CategoryId { get; private set; }

    public Guid AuthorId { get; private set; }

    public int CrmGroupId { get; private set; }

    public string GroupName { get; private set; } = null!;

    public string CourseName { get; private set; } = null!;

    /// <summary>The CRM's period key.</summary>
    public int Week { get; private set; }

    /// <summary>«6», or «13-14» for a two-week kids period.</summary>
    public string PeriodLabel { get; private set; } = null!;

    public DateOnly PeriodFrom { get; private set; }

    public DateOnly PeriodTo { get; private set; }

    public CrmGroupReportStatus Status { get; private set; }

    /// <summary>The scored period as JSON — exactly what the report shows.</summary>
    public string SnapshotJson { get; private set; } = null!;

    /// <summary>SHA-256 of the figures, hex.</summary>
    public string DataHash { get; private set; } = null!;

    /// <summary>The conclusions: the AI's draft, then whatever the mentor made of it.</summary>
    public string Conclusions { get; private set; } = string.Empty;

    /// <summary>The model that wrote the last AI draft, or null when the text is all the mentor's.</summary>
    public string? AiModel { get; private set; }

    public DateTimeOffset? SentAt { get; private set; }

    private CrmGroupReport()
    {
    }

    public static CrmGroupReport Create(
        Guid organizationId,
        Guid branchId,
        Guid categoryId,
        Guid authorId,
        int crmGroupId,
        string groupName,
        string courseName,
        int week,
        string periodLabel,
        DateOnly from,
        DateOnly to,
        string snapshotJson,
        string dataHash,
        DateTimeOffset now)
    {
        if (organizationId == Guid.Empty || branchId == Guid.Empty || categoryId == Guid.Empty || authorId == Guid.Empty)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Отчёт пишет ментор или тимлид своей категории.");
        }

        if (crmGroupId <= 0 || week <= 0)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Неверная группа или неделя CRM.");
        }

        return new CrmGroupReport
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            CategoryId = categoryId,
            AuthorId = authorId,
            CrmGroupId = crmGroupId,
            GroupName = Truncate(groupName, NameMaxLength),
            CourseName = Truncate(courseName, NameMaxLength),
            Week = week,
            PeriodLabel = Truncate(periodLabel, LabelMaxLength),
            PeriodFrom = from,
            PeriodTo = to,
            Status = CrmGroupReportStatus.Draft,
            SnapshotJson = snapshotJson,
            DataHash = dataHash,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    /// <summary>Takes the figures as they are now (after a correction in the CRM).</summary>
    public void Refresh(string snapshotJson, string dataHash, DateTimeOffset now)
    {
        EnsureDraft();
        SnapshotJson = snapshotJson;
        DataHash = dataHash;
        UpdatedAt = now;
    }

    public void SetAiDraft(string conclusions, string model, DateTimeOffset now)
    {
        EnsureDraft();
        Conclusions = Truncate(conclusions, ConclusionsMaxLength);
        AiModel = model;
        UpdatedAt = now;
    }

    public void EditConclusions(string conclusions, DateTimeOffset now)
    {
        EnsureDraft();
        Conclusions = Truncate(conclusions ?? string.Empty, ConclusionsMaxLength);
        UpdatedAt = now;
    }

    public void Send(DateTimeOffset now)
    {
        EnsureDraft();
        if (string.IsNullOrWhiteSpace(Conclusions))
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Напишите выводы перед отправкой.");
        }

        Status = CrmGroupReportStatus.Sent;
        SentAt = now;
        UpdatedAt = now;
    }

    private void EnsureDraft()
    {
        if (Status is not CrmGroupReportStatus.Draft)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Отчёт уже отправлен — менять его нельзя.");
        }
    }

    private static string Truncate(string value, int max)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
