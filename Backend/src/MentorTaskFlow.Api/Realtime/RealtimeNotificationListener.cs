using System.Threading.Channels;
using MentorTaskFlow.Infrastructure.Realtime;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Npgsql;

namespace MentorTaskFlow.Api.Realtime;

/// <summary>Configuration section <c>Realtime</c>.</summary>
public sealed class RealtimeOptions
{
    public const string SectionName = "Realtime";

    /// <summary>
    /// Off in the worker: it serves no browser connections, so holding a listening database connection
    /// there would only cost a connection slot.
    /// </summary>
    public bool ListenerEnabled { get; init; } = true;
}

/// <summary>
/// Forwards <see cref="RealtimeSignal"/>s from PostgreSQL <c>LISTEN</c> to the connected
/// browsers allowed to hear them.
/// </summary>
/// <remarks>
/// <para>
/// Every API replica runs its own listener and serves its own connections, so the database is the
/// only backplane needed — replicas never have to know about each other.
/// </para>
/// <para>
/// A dropped database connection loses the signals sent while it was down. After reconnecting, every
/// client is told to resync rather than left showing data that silently stopped updating.
/// </para>
/// </remarks>
public sealed class RealtimeNotificationListener(
    IConfiguration configuration,
    IOptions<RealtimeOptions> options,
    IHubContext<RealtimeHub> hub,
    ILogger<RealtimeNotificationListener> logger) : BackgroundService
{
    private static readonly TimeSpan MinRetryDelay = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan MaxRetryDelay = TimeSpan.FromSeconds(30);

    // WaitAsync returns on timeout so a silently dead TCP connection is noticed by the probe below
    // instead of blocking forever.
    private static readonly TimeSpan HealthProbeInterval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.ListenerEnabled)
        {
            return;
        }

        var connectionString = configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogWarning("Realtime listener disabled: no DefaultConnection configured.");
            return;
        }

        // Unpooled: a broken listening connection must be thrown away, never handed back to the pool.
        var listenerConnectionString = new NpgsqlConnectionStringBuilder(connectionString) { Pooling = false }.ConnectionString;

        // Bounded so a stalled hub cannot grow memory without limit; on overflow the oldest signal goes,
        // since a newer one for the same data triggers the same refetch.
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(10_000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

        var forwarding = ForwardAsync(queue.Reader, stoppingToken);
        var delay = MinRetryDelay;
        var connectedBefore = false;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = new NpgsqlConnection(listenerConnectionString);
                await connection.OpenAsync(stoppingToken);
                connection.Notification += (_, notification) => queue.Writer.TryWrite(notification.Payload);

                await using (var listen = new NpgsqlCommand($"LISTEN {RealtimeSignal.Channel}", connection))
                {
                    await listen.ExecuteNonQueryAsync(stoppingToken);
                }

                logger.LogInformation("Realtime listener connected.");

                if (connectedBefore)
                {
                    await hub.Clients.All.SendAsync(RealtimeHub.Resync, stoppingToken);
                }

                connectedBefore = true;
                delay = MinRetryDelay;

                while (!stoppingToken.IsCancellationRequested)
                {
                    if (!await connection.WaitAsync(HealthProbeInterval, stoppingToken))
                    {
                        await using var probe = new NpgsqlCommand("SELECT 1", connection);
                        await probe.ExecuteScalarAsync(stoppingToken);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
#pragma warning disable CA1031 // Any failure means "reconnect"; the loop must outlive it.
            catch (Exception exception)
#pragma warning restore CA1031
            {
                logger.LogWarning(exception, "Realtime listener lost its database connection; retrying in {Delay}.", delay);
            }

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            delay = TimeSpan.FromTicks(Math.Min(delay.Ticks * 2, MaxRetryDelay.Ticks));
        }

        queue.Writer.TryComplete();
        await forwarding;
    }

    private async Task ForwardAsync(ChannelReader<string> reader, CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var payload in reader.ReadAllAsync(stoppingToken))
            {
                if (RealtimeSignal.TryDeserialize(payload) is not { } signal)
                {
                    continue;
                }

                try
                {
                    var recipients = hub.Clients.Groups(RealtimeGroups.For(signal));

                    await recipients.SendAsync(RealtimeHub.DataChanged, new { kind = signal.Kind, id = signal.EntityId }, stoppingToken);

                    if (signal.Kind == RealtimeKinds.Assignment)
                    {
                        await recipients.SendAsync(RealtimeHub.AssignmentChanged, new { assignmentId = signal.EntityId }, stoppingToken);
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
#pragma warning disable CA1031 // One undeliverable signal must not stop the forwarding of the rest.
                catch (Exception exception)
#pragma warning restore CA1031
                {
                    logger.LogWarning(exception, "Failed to forward a realtime signal.");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }
}
