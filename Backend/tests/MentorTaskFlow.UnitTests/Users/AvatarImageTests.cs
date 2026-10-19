using System.Text;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Users;

namespace MentorTaskFlow.UnitTests.Users;

/// <summary>What a profile photo must be, read from its own bytes.</summary>
public sealed class AvatarImageTests
{
    [Fact]
    public void An_extended_webp_reports_its_canvas() =>
        AvatarImage.Inspect(WebpX(512, 512)).ShouldBe(new AvatarImage.Info("webp", "image/webp", 512, 512));

    [Fact]
    public void A_lossy_webp_reports_its_frame()
    {
        var info = AvatarImage.Inspect(WebpLossy(256, 256));

        info.Extension.ShouldBe("webp");
        info.Width.ShouldBe(256);
        info.Height.ShouldBe(256);
    }

    [Fact]
    public void A_jpeg_reports_its_frame() =>
        AvatarImage.Inspect(Jpeg(512, 512)).ShouldBe(new AvatarImage.Info("jpg", "image/jpeg", 512, 512));

    /// <summary>A PNG, a GIF, a renamed text file — anything the profile page does not produce.</summary>
    [Fact]
    public void Another_format_is_refused()
    {
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.Concat(new byte[64]).ToArray();

        Should.Throw<UnsupportedMediaTypeException>(() => AvatarImage.Inspect(png)).Code.ShouldBe(ErrorCodes.FileTypeNotAllowed);
        Should.Throw<UnsupportedMediaTypeException>(() => AvatarImage.Inspect(Encoding.UTF8.GetBytes("<svg onload=alert(1)>")));
    }

    [Fact]
    public void A_photo_over_the_size_limit_is_refused() =>
        Should.Throw<PayloadTooLargeException>(() => AvatarImage.Inspect(new byte[AvatarImage.MaxBytes + 1]));

    [Fact]
    public void An_empty_upload_is_refused() =>
        Should.Throw<UnprocessableEntityException>(() => AvatarImage.Inspect([])).Code.ShouldBe(ErrorCodes.FileEmpty);

    [Theory]
    [InlineData(512, 300)]
    [InlineData(32, 32)]
    [InlineData(4096, 4096)]
    public void A_photo_that_is_not_a_modest_square_is_refused(int width, int height) =>
        Should.Throw<UnprocessableEntityException>(() => AvatarImage.Inspect(WebpX(width, height)));

    [Theory]
    [InlineData("0123456789abcdef0123456789abcdef.webp", true)]
    [InlineData("0123456789abcdef0123456789abcdef.jpg", true)]
    [InlineData("../0123456789abcdef0123456789abcd.webp", false)]
    [InlineData("0123456789ABCDEF0123456789ABCDEF.webp", false)]
    [InlineData("0123456789abcdef0123456789abcdef.svg", false)]
    [InlineData("avatar.webp", false)]
    [InlineData(null, false)]
    public void Only_a_server_generated_name_is_a_valid_key(string? key, bool valid) =>
        User.IsValidAvatarKey(key).ShouldBe(valid);

    internal static byte[] WebpX(int width, int height)
    {
        var bytes = new byte[30];
        "RIFF"u8.CopyTo(bytes);
        BitConverter.GetBytes(22).CopyTo(bytes, 4);
        "WEBP"u8.CopyTo(bytes.AsSpan(8));
        "VP8X"u8.CopyTo(bytes.AsSpan(12));
        BitConverter.GetBytes(10).CopyTo(bytes, 16);
        WriteUInt24(bytes, 24, width - 1);
        WriteUInt24(bytes, 27, height - 1);
        return bytes;
    }

    private static byte[] WebpLossy(int width, int height)
    {
        var bytes = new byte[30];
        "RIFF"u8.CopyTo(bytes);
        "WEBP"u8.CopyTo(bytes.AsSpan(8));
        "VP8 "u8.CopyTo(bytes.AsSpan(12));
        bytes[23] = 0x9D;
        bytes[24] = 0x01;
        bytes[25] = 0x2A;
        bytes[26] = (byte)(width & 0xFF);
        bytes[27] = (byte)(width >> 8);
        bytes[28] = (byte)(height & 0xFF);
        bytes[29] = (byte)(height >> 8);
        return bytes;
    }

    internal static byte[] Jpeg(int width, int height)
    {
        // SOI, an APP0 segment, then SOF0 with the frame size.
        var bytes = new List<byte> { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 };
        bytes.AddRange("JFIF\0"u8.ToArray());
        bytes.AddRange(new byte[9]);
        bytes.AddRange(new byte[] { 0xFF, 0xC0, 0x00, 0x11, 0x08, (byte)(height >> 8), (byte)height, (byte)(width >> 8), (byte)width, 0x03 });
        bytes.AddRange(new byte[16]);
        return [.. bytes];
    }

    private static void WriteUInt24(byte[] target, int offset, int value)
    {
        target[offset] = (byte)(value & 0xFF);
        target[offset + 1] = (byte)((value >> 8) & 0xFF);
        target[offset + 2] = (byte)((value >> 16) & 0xFF);
    }
}
