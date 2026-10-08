using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Api.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MentorTaskFlow.Api.Realtime;

/// <summary>
/// Server-to-client only: tells a connected browser that data it may be showing has changed.
/// </summary>
/// <remarks>
/// Exposes no client-callable method. Everything a client learns here is an identifier it then
/// refetches through the ordinary authorized endpoints, so this hub adds no new read path to secure.
/// </remarks>
[Authorize(Policy = MtfPolicies.Authenticated)]
public sealed class RealtimeHub : Hub
{
    public const string Path = "/api/v1/realtime";

    /// <summary>Client method: <c>{ assignmentId }</c> changed. Kept alongside <see cref="DataChanged"/> for tabs still running the previous frontend.</summary>
    public const string AssignmentChanged = "assignmentChanged";

    /// <summary>Client method: <c>{ kind, id }</c> changed — any kind of <c>RealtimeKinds</c>.</summary>
    public const string DataChanged = "dataChanged";

    /// <summary>Client method: signals may have been missed — refetch everything live.</summary>
    public const string Resync = "resync";

    public override async Task OnConnectedAsync()
    {
        // The policy already rejected an unauthenticated caller; a principal that still resolves to no
        // user has an impossible claim shape and gets no group rather than a guessed one.
        if (HttpCurrentUserAccessor.FromPrincipal(Context.User) is not { } user)
        {
            Context.Abort();
            return;
        }

        foreach (var group in RealtimeGroups.For(user))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, group);
        }
        await base.OnConnectedAsync();
    }
}
