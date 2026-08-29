using System.IO.Compression;
using System.Security.Cryptography;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Domain.Submissions;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// Validates an uploaded file against the limits of Приложение L before it reaches the bucket.
/// </summary>
/// <remarks>
/// The order follows TZ 17.2 steps 8–9: size → magic bytes → archive safety. A rejected file never
/// reaches storage, so a temporary file is the only side effect of a bad upload.
/// </remarks>
public sealed class UploadedFileInspector(IOptions<StorageOptions> options)
{
    private static readonly byte[] PdfMagic = "%PDF"u8.ToArray();

    // PPTX is a ZIP: PK\x03\x04.
    private static readonly byte[] ZipMagic = [0x50, 0x4B, 0x03, 0x04];

    private readonly StorageOptions _options = options.Value;

    /// <summary>
    /// Resolves the canonical <see cref="FileExtension"/> from the file name and content type.
    /// </summary>
    public static FileExtension ResolveExtension(string? fileName, string? contentType)
    {
        var ext = Path.GetExtension(fileName)?.ToLowerInvariant();

        return ext switch
        {
            ".pdf" => FileExtension.Pdf,
            ".pptx" => FileExtension.Pptx,
            _ => contentType?.ToLowerInvariant() switch
            {
                "application/pdf" => FileExtension.Pdf,
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" => FileExtension.Pptx,
                _ => throw new ValidationException("Допустимы только PDF и PPTX файлы."),
            },
        };
    }

    /// <summary>
    /// Spools the upload to a temporary file, checks size, magic bytes and (for PPTX) archive safety.
    /// </summary>
    public async Task<InspectedFile> InspectAsync(
        Stream source,
        FileExtension extension,
        long? declaredLength,
        CancellationToken cancellationToken)
    {
        // Step 8: reject obviously oversized uploads before reading the body.
        if (declaredLength > _options.MaxFileBytes)
        {
            throw new ValidationException(
                $"Размер файла не должен превышать {_options.MaxFileBytes / (1024 * 1024)} МБ.");
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

                if (totalBytes > _options.MaxFileBytes)
                {
                    throw new ValidationException(
                        $"Размер файла не должен превышать {_options.MaxFileBytes / (1024 * 1024)} МБ.");
                }

                sha256.AppendData(buffer.AsSpan(0, bytesRead));
                await tempStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            }

            if (totalBytes == 0)
            {
                throw new ValidationException("Файл пуст.");
            }

            var hash = Convert.ToHexStringLower(sha256.GetHashAndReset());

            // Step 9a: magic bytes.
            tempStream.Position = 0;
            await ValidateMagicBytesAsync(tempStream, extension, cancellationToken);

            // Step 9b: archive safety for PPTX (which is a ZIP).
            if (extension is FileExtension.Pptx)
            {
                tempStream.Position = 0;
                ValidateArchiveSafety(tempStream);
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

    private static async Task ValidateMagicBytesAsync(
        Stream stream, FileExtension extension, CancellationToken cancellationToken)
    {
        var expected = extension is FileExtension.Pdf ? PdfMagic : ZipMagic;
        var header = new byte[expected.Length];
        var read = await stream.ReadAtLeastAsync(header, expected.Length, throwOnEndOfStream: false, cancellationToken);

        if (read < expected.Length || !header.AsSpan(0, expected.Length).SequenceEqual(expected))
        {
            var label = extension is FileExtension.Pdf ? "PDF" : "PPTX";
            throw new ValidationException($"Файл не является допустимым {label}.");
        }
    }

    private void ValidateArchiveSafety(Stream stream)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(_options.ZipValidationTimeoutSeconds));

        try
        {
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);

            if (archive.Entries.Count > _options.ZipMaxEntries)
            {
                throw new ValidationException(
                    $"Архив содержит больше {_options.ZipMaxEntries} файлов.");
            }

            long totalUncompressed = 0;

            foreach (var entry in archive.Entries)
            {
                cts.Token.ThrowIfCancellationRequested();

                totalUncompressed += entry.Length;

                if (totalUncompressed > _options.ZipMaxUncompressedBytes)
                {
                    throw new ValidationException("Архив превышает допустимый размер после распаковки.");
                }

                if (entry.CompressedLength > 0
                    && entry.Length / entry.CompressedLength > _options.ZipMaxRatio)
                {
                    throw new ValidationException("Подозрительная степень сжатия (возможная zip-бомба).");
                }
            }
        }
        catch (InvalidDataException)
        {
            throw new ValidationException("Файл PPTX повреждён или не является валидным ZIP-архивом.");
        }
        catch (OperationCanceledException)
        {
            throw new ValidationException("Проверка архива превысила допустимое время.");
        }
    }
}
