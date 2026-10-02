using System.Text.Json;
using System.Text.Json.Serialization;

namespace MentorTaskFlow.Infrastructure.Realtime;

/// <summary>
/// "Assignment <see cref="AssignmentId"/> changed" — the only thing a realtime client is told.
/// </summary>
/// <remarks>
/// <para>
/// Identifiers only, never content: a client reacts by refetching through the ordinary authorized
/// endpoints, so the tenant filters and role checks of every read stay the single gate on what anyone
/// actually sees. The scope fields exist solely so the API can route the signal to the right
/// connections.
/// </para>
/// <para>
/// <see cref="UserIds"/> holds the current assignee and, after a reassignment, the previous one — the
/// mentor who just lost the assignment needs to drop it from their list too.
/// </para>
/// </remarks>
public sealed record AssignmentChangeSignal(
    [property: JsonPropertyName("o")] Guid OrganizationId,
    [property: JsonPropertyName("b")] Guid BranchId,
    [property: JsonPropertyName("c")] Guid CategoryId,
    [property: JsonPropertyName("a")] Guid AssignmentId,
    [property: JsonPropertyName("u")] IReadOnlyList<Guid> UserIds)
{
    /// <summary>The PostgreSQL <c>LISTEN</c>/<c>NOTIFY</c> channel every process publishes to.</summary>
    public const string Channel = "mtf_realtime";

    // PostgreSQL rejects a NOTIFY payload of 8000 bytes or more, and inside a transaction that error
    // would abort the caller's whole unit of work. A signal is ~250 bytes; the margin is deliberate.
    public const int MaxPayloadBytes = 7000;

    public string Serialize() => JsonSerializer.Serialize(this);

    public static AssignmentChangeSignal? TryDeserialize(string payload)
    {
        try
        {
            return JsonSerializer.Deserialize<AssignmentChangeSignal>(payload);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
