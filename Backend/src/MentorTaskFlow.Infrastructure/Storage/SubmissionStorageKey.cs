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

        return $"orgs/{organizationId}/branches/{branchId}/categories/{categoryId}" +
               $"/assignments/{assignmentId}/submissions/{submissionId}{suffix}";
    }
}
