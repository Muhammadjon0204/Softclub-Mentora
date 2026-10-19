using MentorTaskFlow.Domain.Submissions;

namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// Builds the object key for a submission file in the bucket.
/// </summary>
/// <remarks>
/// The key embeds the full scope path so a single bucket holds every organization's data with
/// prefix-based isolation (<c>TEN-066</c>). The submission id makes it unique; the assignment id
/// groups all versions under one prefix for easy listing. No user-supplied string enters the key
/// (<c>SUB-009</c>).
/// </remarks>
internal static class SubmissionStorageKey
{
    public static string For(
        Guid organizationId,
        Guid branchId,
        Guid categoryId,
        Guid assignmentId,
        Guid submissionId,
        FileExtension extension)
    {
        var suffix = Submission.SuffixOf(extension);

        return $"{BranchPrefix(organizationId, branchId)}categories/{categoryId}" +
               $"/assignments/{assignmentId}/submissions/{submissionId}{suffix}";
    }

    /// <summary>
    /// The prefix every key of one branch starts with — the unit the orphan sweep lists (<c>TEN-067</c>).
    /// </summary>
    /// <remarks>Built here, next to <see cref="For"/>, so the two cannot drift apart again: they once
    /// did, and the sweep listed a prefix no object lived under.</remarks>
    public static string BranchPrefix(Guid organizationId, Guid branchId) =>
        $"orgs/{organizationId}/branches/{branchId}/";
}
