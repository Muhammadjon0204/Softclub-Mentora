using System.Text.Json;
using MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

namespace MentorTaskFlow.UnitTests.Integrations;

/// <summary>
/// The CRM moved branch names from one <c>name</c> to <c>nameRu</c>/<c>nameEn</c>/<c>nameTg</c>; a null
/// name used to crash every CRM screen. Both shapes must parse into a usable name.
/// </summary>
public sealed class CrmBranchTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public void Reads_the_per_language_shape_preferring_russian()
    {
        var branch = JsonSerializer.Deserialize<CrmBranch>("""{"id":1,"nameRu":" Профсоюз ","nameEn":"Profsouz","nameTg":"Профсаюз"}""", Json)!;

        Assert.Equal(1, branch.Id);
        Assert.Equal("Профсоюз", branch.DisplayName);
    }

    [Fact]
    public void Reads_the_old_single_name_shape()
    {
        var branch = JsonSerializer.Deserialize<CrmBranch>("""{"id":1,"name":"Profsouz"}""", Json)!;

        Assert.Equal("Profsouz", branch.DisplayName);
    }

    [Fact]
    public void Falls_back_to_another_language_then_to_the_id()
    {
        Assert.Equal("Profsouz", JsonSerializer.Deserialize<CrmBranch>("""{"id":2,"nameRu":"  ","nameEn":"Profsouz"}""", Json)!.DisplayName);
        Assert.Equal("#3", JsonSerializer.Deserialize<CrmBranch>("""{"id":3}""", Json)!.DisplayName);
    }

    [Fact]
    public void A_group_with_the_new_branch_shape_parses()
    {
        const string body = """
            {"data":{"id":392,"name":"C# - 1","course":{"id":8,"name":"C#"},
             "branch":{"id":1,"nameRu":"Профсоюз","nameEn":"Profsouz","nameTg":"Профсаюз"},
             "status":{"id":1,"name":"Started"},"examInterval":{"id":1,"name":"Weekly"},
             "startsAt":"2025-11-17T10:22:20.172+00:00","finishedAt":"2026-12-29T19:00:00+00:00",
             "durationMonths":13,"requiredStudents":5,"enrolledStudents":0,"timeTables":[]},
             "statusCode":200,"errors":[]}
            """;

        var envelope = JsonSerializer.Deserialize<CrmEnvelope<CrmGroup>>(body, Json)!;

        Assert.Equal("Профсоюз", envelope.Data!.Branch.DisplayName);
    }
}
