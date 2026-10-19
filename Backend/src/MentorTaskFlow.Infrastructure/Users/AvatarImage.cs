using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;

namespace MentorTaskFlow.Infrastructure.Users;

/// <summary>
/// Reads the format and dimensions of an uploaded profile photo from its own bytes.
/// </summary>
/// <remarks>
/// Only what the profile page itself produces is accepted: a square WebP or JPEG of modest size. The
/// header is parsed directly rather than decoded by an imaging library — nothing is rendered on the
/// server, so there is no decoder to exploit, and the photo is later served with
/// <c>X-Content-Type-Options: nosniff</c> under its verified type.
/// </remarks>
public static class AvatarImage
{
    public const int MaxBytes = 512 * 1024;
    public const int MinSide = 64;
    public const int MaxSide = 1024;

    public sealed record Info(string Extension, string ContentType, int Width, int Height);

    public static Info Inspect(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length == 0)
        {
            throw new UnprocessableEntityException(ErrorCodes.FileEmpty, "Файл пуст.");
        }

        if (bytes.Length > MaxBytes)
        {
            throw new PayloadTooLargeException(ErrorCodes.FileTooLarge, "Фотография должна быть не больше 512 КБ.");
        }

        var info = TryWebp(bytes) ?? TryJpeg(bytes)
            ?? throw new UnsupportedMediaTypeException(ErrorCodes.FileTypeNotAllowed, "Поддерживаются только WebP и JPEG.");

        var square = Math.Abs(info.Width - info.Height) <= Math.Max(info.Width, info.Height) / 20;

        if (info.Width < MinSide || info.Height < MinSide || info.Width > MaxSide || info.Height > MaxSide || !square)
        {
            throw new UnprocessableEntityException(
                ErrorCodes.FileSignatureMismatch,
                $"Фотография должна быть квадратной, от {MinSide} до {MaxSide} пикселей.");
        }

        return info;
    }

    private static Info? TryWebp(ReadOnlySpan<byte> b)
    {
        if (b.Length < 30 || !b[..4].SequenceEqual("RIFF"u8) || !b.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return null;
        }

        var chunk = b.Slice(12, 4);

        if (chunk.SequenceEqual("VP8 "u8))
        {
            // Lossy: a key frame starts with the 9D 01 2A start code, then 14-bit width and height.
            if (b[23] != 0x9D || b[24] != 0x01 || b[25] != 0x2A)
            {
                return null;
            }

            return new Info("webp", "image/webp", (b[26] | (b[27] << 8)) & 0x3FFF, (b[28] | (b[29] << 8)) & 0x3FFF);
        }

        if (chunk.SequenceEqual("VP8L"u8))
        {
            // Lossless: signature 0x2F, then width-1 and height-1 packed into 14 bits each.
            if (b[20] != 0x2F)
            {
                return null;
            }

            var bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
            return new Info("webp", "image/webp", (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1);
        }

        if (chunk.SequenceEqual("VP8X"u8))
        {
            // Extended: 24-bit canvas width-1 and height-1.
            return new Info(
                "webp",
                "image/webp",
                (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
                (b[27] | (b[28] << 8) | (b[29] << 16)) + 1);
        }

        return null;
    }

    private static Info? TryJpeg(ReadOnlySpan<byte> b)
    {
        if (b.Length < 4 || b[0] != 0xFF || b[1] != 0xD8 || b[2] != 0xFF)
        {
            return null;
        }

        var i = 2;

        while (i + 9 < b.Length)
        {
            if (b[i] != 0xFF)
            {
                return null;
            }

            var marker = b[i + 1];

            // Fill bytes between markers.
            if (marker == 0xFF)
            {
                i++;
                continue;
            }

            var length = (b[i + 2] << 8) | b[i + 3];

            // SOF0..SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but do not.
            if (marker is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC)
            {
                var height = (b[i + 5] << 8) | b[i + 6];
                var width = (b[i + 7] << 8) | b[i + 8];
                return new Info("jpg", "image/jpeg", width, height);
            }

            if (length < 2)
            {
                return null;
            }

            i += 2 + length;
        }

        return null;
    }
}
