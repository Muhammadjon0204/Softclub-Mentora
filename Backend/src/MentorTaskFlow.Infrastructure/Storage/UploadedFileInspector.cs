using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Domain.Submissions;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// Validates an uploaded file against the limits before it reaches the bucket.
/// </summary>
/// <remarks>
/// The order follows TZ 17.2 steps 7–9: allowlist → size → signature → archive safety → structure.
/// A rejected file never reaches storage, so a temporary file is the only side effect of a bad upload.
/// Each failure has its own code and status (415, 413, 422), so a client can tell «wrong type» from
/// «too big» from «damaged».
/// </remarks>
public sealed class UploadedFileInspector(IOptions<StorageOptions> options)
{
    private const string PdfMime = "application/pdf";
    private const string PptxMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    // The content type a presentation's own [Content_Types].xml declares for its main part.
    private const string PresentationMainContentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";

    private const string ContentTypesPart = "[Content_Types].xml";
    private const string PresentationPart = "ppt/presentation.xml";

    // 17.3: the trailer is looked for in the last kilobyte only.
    private const int PdfTrailerWindow = 1024;
    private const int MaxEntryNameLength = 255;

    // [Content_Types].xml is a short manifest; anything bigger is not read into memory.
    private const int MaxContentTypesBytes = 1024 * 1024;

    private static readonly byte[] PdfMagic = "%PDF"u8.ToArray();
    private static readonly byte[] PdfTrailer = "%%EOF"u8.ToArray();

    // PPTX is a ZIP: PK\x03\x04.
    private static readonly byte[] ZipMagic = [0x50, 0x4B, 0x03, 0x04];

    private readonly StorageOptions _options = options.Value;

    /// <summary>
    /// Resolves the canonical <see cref="FileExtension"/> from the file name (<c>SUB-011</c>).
    /// </summary>
    /// <remarks>
    /// The name decides; the declared content type can only veto. A PDF declared as a presentation is
    /// either a confused client or an attempt to store a file under one type and serve it as another.
    /// <c>application/octet-stream</c> and anything unrelated are let through — browsers send them
    /// often enough that refusing would break real uploads, and the signature check follows anyway.
    /// </remarks>
    public static FileExtension ResolveExtension(string? fileName, string? contentType)
    {
        var extension = Path.GetExtension(fileName)?.ToLowerInvariant() switch
        {
            ".pdf" => FileExtension.Pdf,
            ".pptx" => FileExtension.Pptx,
            _ => throw new UnsupportedMediaTypeException(ErrorCodes.FileTypeNotAllowed, "Допустимы только PDF и PPTX файлы."),
        };

        var declared = contentType?.Split(';')[0].Trim().ToLowerInvariant();
        var contradicts = (extension, declared) switch
        {
            (FileExtension.Pdf, PptxMime) => true,
            (FileExtension.Pptx, PdfMime) => true,
            _ => false,
        };

        if (contradicts)
        {
            throw new UnsupportedMediaTypeException(ErrorCodes.FileTypeNotAllowed, "Тип файла не совпадает с его расширением.");
        }

        return extension;
    }

    /// <summary>
    /// Spools the upload to a temporary file, checks size, signature and (for PPTX) archive safety and
    /// structure.
    /// </summary>
    public async Task<InspectedFile> InspectAsync(
        Stream source,
        FileExtension extension,
        long? declaredLength,
        CancellationToken cancellationToken)
    {
        // SUB-014: an oversized declared length is refused before the body is read at all.
        if (declaredLength > _options.MaxFileBytes)
        {
            throw TooLarge();
        }

        // Spool to a temporary file so memory stays flat regardless of file size.
        var tempPath = Path.GetTempFileName();
        FileStream tempStream;

        try
        {
            tempStream = new FileStream(tempPath, FileMode.Create, FileAccess.ReadWrite, FileShare.None,
                bufferSize: 81920, FileOptions.Asynchronous | FileOptions.DeleteOnClose);
        }
        catch
        {
            File.Delete(tempPath);
            throw;
        }

        try
        {
            using var sha256 = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var buffer = new byte[81920];
            long totalBytes = 0;
            int bytesRead;

            while ((bytesRead = await source.ReadAsync(buffer, cancellationToken)) > 0)
            {
                totalBytes += bytesRead;

                // SUB-012: the limit is enforced on bytes actually read, not on a header the client
                // controls.
                if (totalBytes > _options.MaxFileBytes)
                {
                    throw TooLarge();
                }

                sha256.AppendData(buffer.AsSpan(0, bytesRead));
                await tempStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            }

            if (totalBytes == 0)
            {
                throw new UnprocessableEntityException(ErrorCodes.FileEmpty, "Файл пуст.");
            }

            // SUB-014 from the other side: neither value is trustworthy alone, and the disagreement is
            // itself the problem.
            if (declaredLength is { } declared && declared != totalBytes)
            {
                throw new ValidationAppException("file", "Размер файла не совпадает с заявленным.");
            }

            var hash = Convert.ToHexStringLower(sha256.GetHashAndReset());

            tempStream.Position = 0;
            await ValidateSignatureAsync(tempStream, extension, totalBytes, cancellationToken);

            if (extension is FileExtension.Pptx)
            {
                tempStream.Position = 0;
                ValidatePresentation(tempStream);
            }

            tempStream.Position = 0;

            return new InspectedFile(tempStream, totalBytes, hash, extension);
        }
        catch
        {
            await tempStream.DisposeAsync();
            throw;
        }
    }

    private PayloadTooLargeException TooLarge() =>
        new(ErrorCodes.FileTooLarge, $"Размер файла не должен превышать {_options.MaxFileBytes / (1024 * 1024)} МБ.");

    private static UnprocessableEntityException SignatureMismatch(FileExtension extension) =>
        new(ErrorCodes.FileSignatureMismatch, $"Файл не является допустимым {(extension is FileExtension.Pdf ? "PDF" : "PPTX")}.");

    private static UnprocessableEntityException ZipLimit(string detail) => new(ErrorCodes.ZipSafetyLimitExceeded, detail);

    private static UnprocessableEntityException BrokenPresentation() =>
        new(ErrorCodes.PptxStructureInvalid, "Файл не является презентацией PowerPoint.");

    /// <summary>Magic bytes, and for PDF the <c>%%EOF</c> trailer in the last kilobyte (17.3).</summary>
    private static async Task ValidateSignatureAsync(
        Stream stream, FileExtension extension, long length, CancellationToken cancellationToken)
    {
        var expected = extension is FileExtension.Pdf ? PdfMagic : ZipMagic;
        var header = new byte[expected.Length];
        var read = await stream.ReadAtLeastAsync(header, expected.Length, throwOnEndOfStream: false, cancellationToken);

        if (read < expected.Length || !header.AsSpan().SequenceEqual(expected))
        {
            throw SignatureMismatch(extension);
        }

        if (extension is not FileExtension.Pdf)
        {
            return;
        }

        var window = (int)Math.Min(PdfTrailerWindow, length);
        var tail = new byte[window];
        stream.Position = length - window;
        await stream.ReadExactlyAsync(tail, cancellationToken);

        if (tail.AsSpan().IndexOf(PdfTrailer) < 0)
        {
            throw SignatureMismatch(extension);
        }
    }

    /// <summary>
    /// <c>SUB-017</c> and <c>SUB-018</c>: the archive limits first, from the central directory alone —
    /// nothing is extracted — then the OPC parts that distinguish a presentation from any renamed ZIP.
    /// </summary>
    private void ValidatePresentation(Stream stream)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(_options.ZipValidationTimeoutSeconds));

        try
        {
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);

            if (archive.Entries.Count > _options.ZipMaxEntries)
            {
                throw ZipLimit($"Архив содержит больше {_options.ZipMaxEntries} файлов.");
            }

            long totalUncompressed = 0;

            foreach (var entry in archive.Entries)
            {
                cts.Token.ThrowIfCancellationRequested();

                var name = entry.FullName;

                // A name that could leave its directory if anything ever unpacked the file.
                if (name.Length > MaxEntryNameLength
                    || name.StartsWith('/')
                    || name.Contains('\\')
                    || name.Split('/').Contains(".."))
                {
                    throw ZipLimit("Архив содержит недопустимое имя файла.");
                }

                totalUncompressed += entry.Length;

                if (totalUncompressed > _options.ZipMaxUncompressedBytes)
                {
                    throw ZipLimit("Архив превышает допустимый размер после распаковки.");
                }

                if (entry.CompressedLength > 0
                    && entry.Length / entry.CompressedLength > _options.ZipMaxRatio)
                {
                    throw ZipLimit("Подозрительная степень сжатия (возможная zip-бомба).");
                }
            }

            var contentTypes = archive.GetEntry(ContentTypesPart);

            if (contentTypes is null || archive.GetEntry(PresentationPart) is null || contentTypes.Length > MaxContentTypesBytes)
            {
                throw BrokenPresentation();
            }

            using var reader = new StreamReader(contentTypes.Open(), Encoding.UTF8);

            if (!reader.ReadToEnd().Contains(PresentationMainContentType, StringComparison.OrdinalIgnoreCase))
            {
                throw BrokenPresentation();
            }
        }
        catch (InvalidDataException)
        {
            throw BrokenPresentation();
        }
        catch (OperationCanceledException)
        {
            throw ZipLimit("Проверка архива превысила допустимое время.");
        }
    }
}
