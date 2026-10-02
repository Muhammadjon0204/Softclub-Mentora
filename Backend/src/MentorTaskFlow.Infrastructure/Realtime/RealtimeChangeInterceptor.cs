using System.Runtime.CompilerServices;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Reviews;
using MentorTaskFlow.Domain.Submissions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace MentorTaskFlow.Infrastructure.Realtime;

/// <summary>
/// Publishes an <see cref="AssignmentChangeSignal"/> for every assignment a save touched, through
/// PostgreSQL <c>NOTIFY</c>.
/// </summary>
/// <remarks>
/// <para>
/// One hook on the save pipeline instead of a call in every service: every write path — API services,
/// the worker's overdue job, anything added later — goes through <c>SaveChanges</c>, so none can
/// forget to publish.
/// </para>
/// <para>
/// <c>NOTIFY</c> rather than an in-process event because the worker is a separate process with no
/// realtime connections of its own, and because PostgreSQL gives the delivery guarantee for free:
/// issued inside a transaction, a notification is delivered only when that transaction commits and
/// is discarded on rollback — including the rollback before an execution-strategy retry. Nobody is
/// told about a change that did not happen.
/// </para>
/// <para>
/// Publishing never fails a save. Outside a transaction the data is already committed by the time the
/// notification is sent; a lost signal costs a client one refresh, which its reconnect resync covers.
/// </para>
/// </remarks>
public sealed class RealtimeChangeInterceptor(ILogger<RealtimeChangeInterceptor> logger) : SaveChangesInterceptor
{
    // Keyed by context instance: the interceptor is a singleton shared by every DbContext, and the
    // signals collected before a save must reach exactly that context's after-save callback.
    private readonly ConditionalWeakTable<DbContext, List<AssignmentChangeSignal>> _pending = new();

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Collect(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Collect(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        if (Take(eventData.Context) is { } signals)
        {
            PublishAsync(eventData.Context!, signals).AsTask().GetAwaiter().GetResult();
        }

        return result;
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        if (Take(eventData.Context) is { } signals)
        {
            await PublishAsync(eventData.Context!, signals);
        }

        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => Take(eventData.Context);

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        Take(eventData.Context);
        return Task.CompletedTask;
    }

    private void Collect(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        // SavingChanges runs before EF's own DetectChanges, so a property set on a tracked entity would
        // still read as Unchanged here without this.
        context.ChangeTracker.DetectChanges();

        var byAssignment = new Dictionary<Guid, AssignmentChangeSignal>();

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
            {
                continue;
            }

            var signal = entry.Entity switch
            {
                Assignment assignment => ForAssignment(
                    assignment,
                    entry.State == EntityState.Modified
                        ? (entry.Property(nameof(Assignment.AssignedToId)).OriginalValue as Guid?,
                            entry.Property(nameof(Assignment.Status)).OriginalValue as AssignmentStatus?)
                        : null),
                Submission submission => new AssignmentChangeSignal(
                    submission.OrganizationId,
                    submission.BranchId,
                    submission.CategoryId,
                    submission.AssignmentId,
                    [submission.SubmittedById]),
                Review review => new AssignmentChangeSignal(
                    review.OrganizationId,
                    review.BranchId,
                    review.CategoryId,
                    review.AssignmentId,
                    []),
                _ => null,
            };

            if (signal is null)
            {
                continue;
            }

            byAssignment[signal.AssignmentId] = byAssignment.TryGetValue(signal.AssignmentId, out var existing)
                ? existing with { UserIds = existing.UserIds.Union(signal.UserIds).ToArray() }
                : signal;
        }

        if (byAssignment.Count > 0)
        {
            _pending.AddOrUpdate(context, [.. byAssignment.Values]);
        }
    }

    /// <remarks>
    /// A mentor is signalled exactly when the change is visible in their own list, which hides
    /// <c>Draft</c> and <c>Suggested</c> (the Mentor read scope in <c>AssignmentService</c>): the
    /// current assignee if the assignment is visible now, the previous one if it was visible before.
    /// Otherwise a Lead's unpublished draft would announce itself to the mentor it is meant for.
    /// </remarks>
    private static AssignmentChangeSignal ForAssignment(
        Assignment assignment,
        (Guid? AssigneeId, AssignmentStatus? Status)? original)
    {
        var users = new List<Guid>(2);

        if (IsVisibleToMentor(assignment.Status))
        {
            users.Add(assignment.AssignedToId);
        }

        if (original is { AssigneeId: { } previousAssignee, Status: { } previousStatus }
            && IsVisibleToMentor(previousStatus)
            && !users.Contains(previousAssignee))
        {
            users.Add(previousAssignee);
        }

        return new AssignmentChangeSignal(
            assignment.OrganizationId,
            assignment.BranchId,
            assignment.CategoryId,
            assignment.Id,
            users);
    }

    private static bool IsVisibleToMentor(AssignmentStatus status) =>
        status is not (AssignmentStatus.Draft or AssignmentStatus.Suggested);

    private List<AssignmentChangeSignal>? Take(DbContext? context)
    {
        if (context is null || !_pending.TryGetValue(context, out var signals))
        {
            return null;
        }

        _pending.Remove(context);
        return signals;
    }

    private async ValueTask PublishAsync(DbContext context, List<AssignmentChangeSignal> signals)
    {
        var payloads = signals
            .Select(signal => signal.Serialize())
            .Where(payload => System.Text.Encoding.UTF8.GetByteCount(payload) <= AssignmentChangeSignal.MaxPayloadBytes)
            .ToArray();

        if (payloads.Length == 0)
        {
            return;
        }

        var database = context.Database;

        try
        {
            // The raw connection rather than ExecuteSql: that would go through the retrying execution
            // strategy, which refuses to run inside a caller's transaction unless it owns it. On the raw
            // connection, enlisting in the caller's transaction is exactly what defers the NOTIFY to
            // its commit.
            await database.OpenConnectionAsync(CancellationToken.None);

            try
            {
                await NotifyAsync(database.GetDbConnection(), database.CurrentTransaction?.GetDbTransaction(), payloads);
            }
            finally
            {
                await database.CloseConnectionAsync();
            }
        }
#pragma warning disable CA1031 // Publishing is best-effort by design; no failure of it may fail the caller's save.
        catch (Exception exception)
#pragma warning restore CA1031
        {
            logger.LogWarning(exception, "Failed to publish {Count} realtime assignment signal(s).", payloads.Length);
        }
    }

    private const string Savepoint = "mtf_realtime_notify";

    private static async Task NotifyAsync(
        System.Data.Common.DbConnection connection,
        System.Data.Common.DbTransaction? transaction,
        string[] payloads)
    {
        // Inside a caller's transaction a failed statement would mark the whole transaction aborted and
        // its COMMIT would fail — the user's change lost over a notification. The savepoint confines
        // any failure to the NOTIFY alone.
        if (transaction is not null)
        {
            await transaction.SaveAsync(Savepoint);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "SELECT pg_notify(@channel, payload) FROM unnest(@payloads) AS payload";
            command.Parameters.Add(new NpgsqlParameter("channel", NpgsqlDbType.Text) { Value = AssignmentChangeSignal.Channel });
            command.Parameters.Add(new NpgsqlParameter("payloads", NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = payloads });

            // Not the caller's token: cancelling mid-command inside a transaction would abort it.
            await command.ExecuteNonQueryAsync(CancellationToken.None);

            if (transaction is not null)
            {
                await transaction.ReleaseAsync(Savepoint);
            }
        }
        catch when (transaction is not null)
        {
            await transaction.RollbackAsync(Savepoint);
            throw;
        }
    }
}
