namespace MentorTaskFlow.Domain.Notifications;

/// <summary>
/// The notification event types: the 19 of Приложение E plus <see cref="SubmissionReceipt"/>.
/// </summary>
/// <remarks>
/// Section 18.2 and Приложение E must agree; a divergence is a defect in the document. The list is
/// reproduced here once so the code cannot add a nineteenth-and-a-half.
/// </remarks>
public static class NotificationEventTypes
{
    // Study cycle — always branch- and category-scoped.
    public const string AssignmentAssigned = "AssignmentAssigned";
    public const string AssignmentSuggested = "AssignmentSuggested";
    public const string AssignmentReassigned = "AssignmentReassigned";
    public const string SubmissionUploaded = "SubmissionUploaded";
    public const string LateSubmissionUploaded = "LateSubmissionUploaded";

    /// <summary>
    /// Confirmation to the mentor that their work went to review — what was sent and to whom.
    /// </summary>
    /// <remarks>An addition to Приложение E, requested on 2026-10-11. Telegram only: an email about
    /// one's own action a second ago is noise.</remarks>
    public const string SubmissionReceipt = "SubmissionReceipt";
    public const string ReviewApproved = "ReviewApproved";
    public const string ReviewNeedsRework = "ReviewNeedsRework";

    /// <summary>A mentor sent their weekly CRM group report: the Lead of the category is told.</summary>
    public const string CrmReportSent = "CrmReportSent";
    public const string DeadlineReminder = "DeadlineReminder";
    public const string AssignmentOverdue = "AssignmentOverdue";
    public const string AssignmentCancelled = "AssignmentCancelled";

    // Category-level.
    public const string SchedulerNoActiveMentor = "SchedulerNoActiveMentor";
    public const string CategoryWithoutLead = "CategoryWithoutLead";

    // Branch-level.
    public const string BranchDeactivated = "BranchDeactivated";
    public const string BranchActivated = "BranchActivated";

    /// <summary>Addressed to the user's <b>new</b> branch: they have already been transferred.</summary>
    public const string UserBranchChanged = "UserBranchChanged";

    // Organization-level.
    public const string BranchWithoutAdmin = "BranchWithoutAdmin";
    public const string OrganizationSystemAlert = "OrganizationSystemAlert";
    public const string NotificationDeadLetter = "NotificationDeadLetter";

    /// <summary>Invitation to set a first password, produced on user creation and on bootstrap.</summary>
    public const string UserInvitation = "UserInvitation";

    /// <summary>A password reset link the person asked for on the sign-in page, sent by email.</summary>
    /// <remarks>Like the invitation, the link is minted by the dispatcher at send time and never stored
    /// in the row (<c>NTF-017</c>).</remarks>
    public const string PasswordReset = "PasswordReset";

    /// <summary>The same reset link, sent to the bound Telegram chat — or by email when there is none.</summary>
    /// <remarks>
    /// A separate event rather than both channels at once: only one reset link may be live
    /// (<c>AUTH-017</c>), and each send mints a new one, so a second channel would void the first.
    /// </remarks>
    public const string PasswordResetTelegram = "PasswordResetTelegram";

    /// <summary>
    /// The only event types permitted to carry <c>BranchId IS NULL</c> (<c>TEN-042</c>).
    /// </summary>
    /// <remarks>
    /// <para>
    /// Source of truth for <c>ck_notification_outbox_branch_scope</c>. Each entry concerns the
    /// organization rather than any one branch: a branch left without an administrator is answered by
    /// the Organization Admin, and a system alert has no branch at all.
    /// </para>
    /// <para>
    /// <see cref="UserInvitation"/> is here because the bootstrap administrator is an Organization
    /// Admin with no branch (<c>DEPLOY-031</c>); an invitation to a Branch Admin, Lead or Mentor always
    /// carries their branch. The two reset events are here for the same administrator, who can forget
    /// a password like anyone else.
    /// </para>
    /// </remarks>
    public static readonly IReadOnlySet<string> OrganizationLevelEvents = new HashSet<string>(StringComparer.Ordinal)
    {
        BranchWithoutAdmin,
        OrganizationSystemAlert,
        NotificationDeadLetter,
        UserInvitation,
        PasswordReset,
        PasswordResetTelegram,
    };
}
