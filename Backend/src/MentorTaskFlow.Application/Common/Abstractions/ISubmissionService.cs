using MentorTaskFlow.Contracts.Submissions;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>An uploaded file as it arrives from the transport, with nothing trusted yet.</summary>
/// <remarks>
/// The scope of the object is never taken from here: organization, branch and category come from the
/// assignment on the server, and their presence in the form is itself a validation failure
/// (<c>TEN-061</c>, <c>SEC-003</c>).
/// </remarks>
public sealed record UploadedFile(
    Stream Content,
    string FileName,
    string? ContentType,
    long? Length);

/// <summary>Submission upload and retrieval (TZ 15.6, 17).</summary>
public interface ISubmissionService
{
    /// <summary>
    /// Uploads a version of the work — a file, a comment, or both.
    /// </summary>
    /// <remarks>
    /// Runs the validation order of 17.2 exactly as written whenever a file is attached, which is what
    /// guarantees a rejected file never reaches the bucket: everything from the mentor's own
    /// organization being active to the archive-safety limits is settled before the first byte is
    /// handed to storage. <paramref name="file"/> is null for a comment-only submission (2026-09-28) —
    /// not every task produces a file, e.g. "call the parents" — in which case none of that runs and
    /// <paramref name="comment"/> must be non-empty.
    /// </remarks>
    Task<SubmissionDto> UploadAsync(Guid assignmentId, UploadedFile? file, string? comment, CancellationToken cancellationToken);

    /// <summary>Lists the versions of one assignment, newest first, without any storage key (<c>SUB-005</c>).</summary>
    Task<IReadOnlyList<SubmissionDto>> ListAsync(Guid assignmentId, CancellationToken cancellationToken);

    /// <summary>
    /// Issues a download URL after repeating the visibility checks in full (<c>SUB-006</c>).
    /// </summary>
    /// <remarks>
    /// An Organization Admin must name a branch: handing out a file is an operation of one branch, not
    /// an aggregate over all of them, so the all-branches mode has no meaning here and returns 400
    /// <c>BRANCH_CONTEXT_REQUIRED</c> (<c>TEN-065</c>).
    /// </remarks>
    Task<FileUrlDto> GetDownloadUrlAsync(Guid submissionId, CancellationToken cancellationToken);

    /// <summary>
    /// Issues a preview URL for a PDF.
    /// </summary>
    /// <remarks>
    /// A PPTX has no preview in Release 1.0 and answers 404 — the resource genuinely does not exist,
    /// rather than existing and being refused (17.5).
    /// </remarks>
    Task<FileUrlDto> GetPreviewUrlAsync(Guid submissionId, CancellationToken cancellationToken);
}
