using System.Text.Json;
using System.Text.Json.Serialization;

namespace MentorTaskFlow.Infrastructure.Realtime;

/// <summary>What kind of data a <see cref="RealtimeSignal"/> is about — decides who may hear it.</summary>
public static class RealtimeKinds
{
    /// <summary>An assignment, one of its submissions or its review.</summary>
    public const string Assignment = "assignment";

    /// <summary>A user: invited, accepted the invite, renamed, moved, deactivated, signed in.</summary>
    public const string User = "user";

    /// <summary>A category or its settings, including who leads it.</summary>
    public const string Category = "category";

    public const string Branch = "branch";

    /// <summary>A notification outbox row — queued, sent, failed. Seen by administrators only.</summary>
    public const string Notification = "notification";

    /// <summary>The category's curriculum: topics and their assignment templates, shared by the whole team.</summary>
    public const string Schedule = "schedule";
}

/// <summary>
/// "<see cref="Kind"/> <see cref="EntityId"/> changed" — the only thing a realtime client is told.
/// </summary>
/// <remarks>
/// <para>
/// Identifiers only, never content: a client reacts by refetching through the ordinary authorized
/// endpoints, so the tenant filters and role checks of every read stay the single gate on what anyone
/// actually sees. The scope fields exist solely so the API can route the signal to the right
/// connections (see <c>RealtimeGroups</c>).
/// </para>
/// <para>
/// <see cref="UserIds"/> are individual people to notify on top of the scope groups: the assignee of an
/// assignment (and the previous one after a reassignment), or the user a user-change is about.
/// </para>
/// </remarks>
public sealed record RealtimeSignal(
    [property: JsonPropertyName("k")] string Kind,
    [property: JsonPropertyName("o")] Guid OrganizationId,
    [property: JsonPropertyName("b")] Guid? BranchId,
    [property: JsonPropertyName("c")] Guid? CategoryId,
    [property: JsonPropertyName("e")] Guid EntityId,
    [property: JsonPropertyName("u")] IReadOnlyList<Guid> UserIds)
{
    /// <summary>The PostgreSQL <c>LISTEN</c>/<c>NOTIFY</c> channel every process publishes to.</summary>
    public const string Channel = "mtf_realtime";

    // PostgreSQL rejects a NOTIFY payload of 8000 bytes or more, and inside a transaction that error
    // would abort the caller's whole unit of work. A signal is ~250 bytes; the margin is deliberate.
    public const int MaxPayloadBytes = 7000;

    public string Serialize() => JsonSerializer.Serialize(this);

    public static RealtimeSignal? TryDeserialize(string payload)
    {
        try
        {
            return JsonSerializer.Deserialize<RealtimeSignal>(payload);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
