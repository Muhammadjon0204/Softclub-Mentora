using MentorTaskFlow.Domain.Submissions;

namespace MentorTaskFlow.Infrastructure.Storage;

/// <summary>
/// The result of <see cref="UploadedFileInspector.InspectAsync"/>: a validated, seekable copy of the
/// upload together with the metadata the persistence layer needs.
/// </summary>
/// <remarks>
/// Implements <see cref="IAsyncDisposable"/> because the temporary file backing <see cref="Content"/>
/// must be deleted when the request ends, whether it succeeded or not.
/// </remarks>
public sealed class InspectedFile : IAsyncDisposable
{
    private readonly FileStream? _backingStream;

    internal InspectedFile(FileStream backingStream, long sizeBytes, string sha256Hash, FileExtension extension)
    {
        _backingStream = backingStream;
        Content = backingStream;
        SizeBytes = sizeBytes;
        Sha256Hash = sha256Hash;
        Extension = extension;
    }

    /// <summary>Seekable stream over the validated bytes, positioned at 0.</summary>
    public Stream Content { get; }

    /// <summary>Exact byte count after spooling.</summary>
    public long SizeBytes { get; }

    /// <summary>Lower-case hex SHA-256 of the whole file.</summary>
    public string Sha256Hash { get; }

    /// <summary>The resolved file type.</summary>
    public FileExtension Extension { get; }

    public async ValueTask DisposeAsync()
    {
        if (_backingStream is not null)
        {
            await _backingStream.DisposeAsync();

            try
            {
                File.Delete(_backingStream.Name);
            }
            catch
            {
                // Best effort — the OS will reclaim /tmp eventually.
            }
        }
    }
}
