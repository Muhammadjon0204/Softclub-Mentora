using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Common;

namespace MentorTaskFlow.Domain.Submissions;

/// <summary>The two accepted file types (<c>SUB-011</c>).</summary>
public enum FileExtension
{
    Pdf = 0,
    Pptx = 1,
}

/// <summary>
/// The already-inspected, already-uploaded file a submission attaches — everything <see cref="Submission.Record"/>
/// needs about it, grouped so the factory's signature doesn't grow a sixth nullable positional parameter.
/// </summary>
public sealed record SubmittedFile(
    string StorageKey,
    string OriginalFileName,
    FileExtension Extension,
    long FileSizeBytes,
    string Sha256Hash);

/// <summary>
/// One uploaded version of a mentor's work (TZ 10.7).
/// </summary>
/// <remarks>
/// <para>
/// Immutable: no role edits or deletes a submission, and a re-upload always creates a new row with the
/// next version number (<c>SUB-020</c>). Hence no concurrency token — the entity is never updated
/// (11.6).
/// </para>
/// <para>
/// The scope fields are copied from the assignment rather than from the request. They are what the
/// storage key is built from, and accepting them from a client would let a caller write into another
/// branch's prefix (<c>TEN-061</c>).
/// </para>
/// </remarks>
public sealed class Submission : BaseEntity
{
    public const int OriginalFileNameMaxLength = 255;
    public const int StorageKeyMaxLength = 320;
    public const int Sha256Length = 64;
    public const int CommentMaxLength = 2000;

    public Guid AssignmentId { get; private set; }

    public Guid OrganizationId { get; private set; }

    public Guid BranchId { get; private set; }

    public Guid CategoryId { get; private set; }

    /// <summary>Starts at 1; assigned under the assignment's row lock (12.5).</summary>
    public int VersionNumber { get; private set; }

    /// <summary>
    /// Never leaves the server (<c>SUB-008</c>). Null exactly when <see cref="FileExtension"/> is null —
    /// not every task produces a file (e.g. "call the parents"), so a mentor may hand in a
    /// <see cref="Comment"/> alone (2026-09-28). The two file-or-comment fields are never both empty:
    /// enforced here and mirrored by <c>ck_submissions_file_or_comment</c> at the database.
    /// </summary>
    public string? StorageKey { get; private set; }

    public string? OriginalFileName { get; private set; }

    public string? ContentType { get; private set; }

    public FileExtension? FileExtension { get; private set; }

    public long? FileSizeBytes { get; private set; }

    /// <summary>Lower-case hex of the whole file. The index is <b>not</b> unique (<c>SUB-027</c>). Null when there is no file.</summary>
    public string? Sha256Hash { get; private set; }

    /// <summary>What the mentor did, in their own words — the only content on a file-less submission, and optional context alongside a file.</summary>
    public string? Comment { get; private set; }

    public bool IsLate { get; private set; }

    public Guid SubmittedById { get; private set; }

    public DateTimeOffset SubmittedAt { get; private set; }

    /// <summary>Equal to <see cref="StorageKey"/> for PDF, null for PPTX in Release 1.0 (17.5).</summary>
    public string? PreviewStorageKey { get; private set; }

    /// <summary>Reserved for the asynchronous PPTX conversion of a later version; always null here.</summary>
    public string? ConversionStatus { get; private set; }

    private Submission()
    {
    }

    /// <summary>
    /// Records a version of the work — a file, a comment, or both, but never neither (2026-09-28: not
    /// every assignment produces a file to attach, e.g. "call the parents").
    /// </summary>
    /// <remarks>
    /// <para>
    /// The identifier is supplied rather than generated here: when a file is attached, the storage key
    /// is built from it and the object is uploaded before the row exists, so both must name the same
    /// submission (<c>SUB-009</c>, <c>SUB-030</c>).
    /// </para>
    /// <para>
    /// <paramref name="isLate"/> is decided by the caller because it depends on the assignment's state
    /// and on the clock, both of which live outside this entity (<c>SUB-025</c>).
    /// </para>
    /// <para>
    /// <paramref name="file"/> is null for a comment-only submission; when present, every one of its
    /// fields is required together — there is no such thing as a submission with a hash but no name.
    /// </para>
    /// </remarks>
    public static Submission Record(
        Guid id,
        Assignment assignment,
        int versionNumber,
        SubmittedFile? file,
        string? comment,
        bool isLate,
        Guid submittedById,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(assignment);

        if (versionNumber < 1)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "VersionNumber начинается с 1.");
        }

        // The uploader is the executor by definition. A mismatch means the ownership check of 17.2
        // step 3 was skipped, and the row would attribute one person's work to another.
        if (submittedById != assignment.AssignedToId)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                "Загрузить работу может только исполнитель задачи.");
        }

        var trimmedComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();

        if (trimmedComment is { Length: > CommentMaxLength })
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"Комментарий не длиннее {CommentMaxLength} символов.");
        }

        if (file is null && trimmedComment is null)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                "Нужно приложить файл или написать комментарий — оба поля пустыми быть не могут.");
        }

        string? storageKey = null;
        string? originalFileName = null;
        string? contentType = null;
        FileExtension? extension = null;
        long? fileSizeBytes = null;
        string? sha256Hash = null;
        string? previewStorageKey = null;

        if (file is not null)
        {
            if (file.FileSizeBytes <= 0)
            {
                throw new DomainException(DomainErrorCodes.ValidationFailed, "Размер файла должен быть больше нуля.");
            }

            var trimmedName = (file.OriginalFileName ?? string.Empty).Trim();

            if (trimmedName.Length is 0 or > OriginalFileNameMaxLength)
            {
                throw new DomainException(
                    DomainErrorCodes.ValidationFailed,
                    $"Имя файла обязательно и не длиннее {OriginalFileNameMaxLength} символов.");
            }

            if (file.Sha256Hash is not { Length: Sha256Length })
            {
                throw new DomainException(DomainErrorCodes.ValidationFailed, "Sha256Hash обязан быть 64-символьным hex.");
            }

            storageKey = file.StorageKey;
            originalFileName = trimmedName;
            contentType = ContentTypeOf(file.Extension);
            extension = file.Extension;
            fileSizeBytes = file.FileSizeBytes;
            sha256Hash = file.Sha256Hash.ToLowerInvariant();

            // PDF is previewed as itself; PPTX has no preview in Release 1.0, and null is what says so.
            // (Fully qualified: the instance property below shares its name with this enum, and in
            // expression position — unlike a type-position parameter/property declaration — the
            // property shadows the type, so a bare `FileExtension.Pdf` here would mean "this instance's
            // FileExtension property, dotted with .Pdf", not the enum member.)
            previewStorageKey = file.Extension is global::MentorTaskFlow.Domain.Submissions.FileExtension.Pdf ? file.StorageKey : null;
        }

        return new Submission
        {
            Id = id,
            AssignmentId = assignment.Id,
            OrganizationId = assignment.OrganizationId,
            BranchId = assignment.BranchId,
            CategoryId = assignment.CategoryId,
            VersionNumber = versionNumber,
            StorageKey = storageKey,
            OriginalFileName = originalFileName,
            ContentType = contentType,
            FileExtension = extension,
            FileSizeBytes = fileSizeBytes,
            Sha256Hash = sha256Hash,
            Comment = trimmedComment,
            IsLate = isLate,
            SubmittedById = submittedById,
            SubmittedAt = now,
            PreviewStorageKey = previewStorageKey,
            ConversionStatus = null,
            CreatedAt = now,
        };
    }

    // Fully qualified (not just `FileExtension.Pdf`): the instance property of the same name shadows
    // the enum type in expression position within this class, ever since FileExtension became nullable
    // (2026-09-28) — see the longer note above `previewStorageKey`.
    public static string ContentTypeOf(FileExtension extension) => extension switch
    {
        global::MentorTaskFlow.Domain.Submissions.FileExtension.Pdf => "application/pdf",
        global::MentorTaskFlow.Domain.Submissions.FileExtension.Pptx => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => throw new DomainException(DomainErrorCodes.ValidationFailed, "Неизвестное расширение файла."),
    };

    public static string SuffixOf(FileExtension extension) => extension switch
    {
        global::MentorTaskFlow.Domain.Submissions.FileExtension.Pdf => ".pdf",
        global::MentorTaskFlow.Domain.Submissions.FileExtension.Pptx => ".pptx",
        _ => throw new DomainException(DomainErrorCodes.ValidationFailed, "Неизвестное расширение файла."),
    };
}
