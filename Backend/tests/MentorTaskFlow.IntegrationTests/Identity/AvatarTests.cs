using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using MentorTaskFlow.Contracts.Auth;
using MentorTaskFlow.Contracts.Users;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Identity;
using MentorTaskFlow.IntegrationTests.Persistence;

namespace MentorTaskFlow.IntegrationTests.Identity;

/// <summary>Profile photos: upload, serving, the directory, replacement and removal.</summary>
[Collection(PostgresCollection.Name)]
public sealed class AvatarTests(PostgresFixture postgres, MinioFixture minio) : IAsyncLifetime
{
    private const string Password = "Avatar26";

    private static readonly DateTimeOffset Seeded = new(2026, 10, 19, 9, 0, 0, TimeSpan.Zero);

    private MentorTaskFlowApiFactory _factory = null!;
    private Guid _mentorId;

    public async Task InitializeAsync()
    {
        await postgres.ResetAsync();
        await minio.ResetAsync();

        await using (var context = postgres.CreateContext(suppressTenantFilter: true))
        {
            var organization = Organization.Provision("SoftClub Academy", "softclub-academy", Seeded);
            var branch = Branch.CreateHeadOffice(organization.Id, "Главный офис", "HQ", null, "Asia/Dushanbe", Seeded);
            var admin = User.CreateBranchAdmin(organization.Id, branch.Id, "Админ", "admin@mentortaskflow.test", Seeded);
            var mentor = User.CreateBranchAdmin(organization.Id, branch.Id, "Фарзона Каримова", "mentor@mentortaskflow.test", Seeded);
            var hash = new Pbkdf2PasswordHasher().Hash(Password);
            admin.SetPasswordHash(hash, Seeded);
            mentor.SetPasswordHash(hash, Seeded);

            context.Organizations.Add(organization);
            context.Branches.Add(branch);
            context.Users.AddRange(admin, mentor);
            await context.SaveChangesAsync();
            _mentorId = mentor.Id;
        }

        _factory = new MentorTaskFlowApiFactory
        {
            ConnectionStringOverride = postgres.ConnectionString,
            StorageEndpointOverride = minio.Endpoint,
        };
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task An_uploaded_photo_is_served_anonymously_cached_for_good_and_listed()
    {
        using var mentor = await SignInAsync("mentor@mentortaskflow.test");

        var profile = await UploadAsync(mentor, Webp(512));
        profile.AvatarUrl.ShouldNotBeNull();
        profile.AvatarUrl.ShouldStartWith("/api/v1/avatars/");

        // No token: an <img> cannot send one.
        using var anonymous = _factory.CreateClient();
        var photo = await anonymous.GetAsync(profile.AvatarUrl);

        photo.StatusCode.ShouldBe(HttpStatusCode.OK);
        photo.Content.Headers.ContentType!.MediaType.ShouldBe("image/webp");
        photo.Headers.CacheControl!.ToString().ShouldContain("immutable");
        (await photo.Content.ReadAsByteArrayAsync()).ShouldBe(Webp(512));

        // Everyone in the organization learns about it from the directory.
        using var admin = await SignInAsync("admin@mentortaskflow.test");
        var directory = await admin.GetFromJsonAsync<List<UserAvatarDto>>("/api/v1/users/avatars");
        directory!.ShouldContain(new UserAvatarDto(_mentorId, profile.AvatarUrl));
    }

    [Fact]
    public async Task A_new_photo_gets_a_new_address_and_the_old_one_disappears()
    {
        using var mentor = await SignInAsync("mentor@mentortaskflow.test");

        var first = await UploadAsync(mentor, Webp(512));
        var second = await UploadAsync(mentor, Webp(256));

        second.AvatarUrl.ShouldNotBe(first.AvatarUrl);

        using var anonymous = _factory.CreateClient();
        (await anonymous.GetAsync(first.AvatarUrl)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await anonymous.GetAsync(second.AvatarUrl)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await minio.ListKeysAsync()).Count(k => k.StartsWith("avatars/", StringComparison.Ordinal)).ShouldBe(1);
    }

    [Fact]
    public async Task Removing_the_photo_returns_to_initials_and_deletes_the_file()
    {
        using var mentor = await SignInAsync("mentor@mentortaskflow.test");
        var uploaded = await UploadAsync(mentor, Webp(512));

        var response = await mentor.DeleteAsync("/api/v1/auth/me/avatar");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync<AuthUserDto>(response)).AvatarUrl.ShouldBeNull();

        using var anonymous = _factory.CreateClient();
        (await anonymous.GetAsync(uploaded.AvatarUrl)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    /// <summary>The name in the URL is checked before it reaches storage.</summary>
    [Theory]
    [InlineData("..%2F..%2Fsubmissions%2Fx.pdf")]
    [InlineData("avatar.svg")]
    public async Task A_name_the_server_never_generated_is_not_found(string name)
    {
        using var anonymous = _factory.CreateClient();
        (await anonymous.GetAsync($"/api/v1/avatars/{name}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Something_other_than_a_photo_is_refused()
    {
        using var mentor = await SignInAsync("mentor@mentortaskflow.test");

        using var form = Form("<svg onload=alert(1)>"u8.ToArray(), "image/svg+xml", "x.svg");
        var response = await mentor.PutAsync("/api/v1/auth/me/avatar", form);

        response.StatusCode.ShouldBe(HttpStatusCode.UnsupportedMediaType);
        (await minio.ListKeysAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task Uploading_requires_a_signed_in_user()
    {
        using var anonymous = _factory.CreateClient();
        using var form = Form(Webp(512), "image/webp", "avatar.webp");

        (await anonymous.PutAsync("/api/v1/auth/me/avatar", form)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private async Task<AuthUserDto> UploadAsync(HttpClient client, byte[] bytes)
    {
        using var form = Form(bytes, "image/webp", "avatar.webp");
        var response = await client.PutAsync("/api/v1/auth/me/avatar", form);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await ReadAsync<AuthUserDto>(response);
    }

    private static MultipartFormDataContent Form(byte[] bytes, string contentType, string fileName)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    /// <summary>A minimal extended WebP header of the given side — the server reads only the header.</summary>
    private static byte[] Webp(int side)
    {
        var bytes = new byte[30];
        "RIFF"u8.CopyTo(bytes);
        BitConverter.GetBytes(22).CopyTo(bytes, 4);
        "WEBP"u8.CopyTo(bytes.AsSpan(8));
        "VP8X"u8.CopyTo(bytes.AsSpan(12));
        BitConverter.GetBytes(10).CopyTo(bytes, 16);
        bytes[24] = (byte)((side - 1) & 0xFF);
        bytes[25] = (byte)((side - 1) >> 8);
        bytes[27] = (byte)((side - 1) & 0xFF);
        bytes[28] = (byte)((side - 1) >> 8);
        return bytes;
    }

    private async Task<HttpClient> SignInAsync(string email)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Password));
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await ReadAsync<LoginResponse>(response)).AccessToken);
        return client;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<T>(await response.Content.ReadAsStringAsync(), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
}
