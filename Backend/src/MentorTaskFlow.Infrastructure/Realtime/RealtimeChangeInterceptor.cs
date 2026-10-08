using System.Runtime.CompilerServices;
using MentorTaskFlow.Domain.Assignments;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Reviews;
using MentorTaskFlow.Domain.Schedule;
using MentorTaskFlow.Domain.Submissions;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace MentorTaskFlow.Infrastructure.Realtime;

/// <summary>
/// Publishes a <see cref="RealtimeSignal"/> for every user-visible entity a save touched, through
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
    private readonly ConditionalWeakTable<DbContext, List<RealtimeSignal>> _pending = new();

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

        // Keyed by kind, entity and scope: several rows of one save about the same thing collapse into
        // one signal, while a user who moved category yields one for the old scope and one for the new.
        var signals = new Dictionary<(string, Guid, Guid?, Guid?), RealtimeSignal>();

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
            {
                continue;
            }

            foreach (var signal in SignalsFor(entry))
            {
                var key = (signal.Kind, signal.EntityId, signal.BranchId, signal.CategoryId);

                signals[key] = signals.TryGetValue(key, out var existing)
                    ? existing with { UserIds = existing.UserIds.Union(signal.UserIds).ToArray() }
                    : signal;
            }
        }

        if (signals.Count > 0)
        {
            _pending.AddOrUpdate(context, [.. signals.Values]);
        }
    }

    private static IEnumerable<RealtimeSignal> SignalsFor(EntityEntry entry)
    {
        switch (entry.Entity)
        {
            case Assignment assignment:
                yield return ForAssignment(
                    assignment,
                    entry.State == EntityState.Modified
                        ? (Original<Guid>(entry, nameof(Assignment.AssignedToId)), Original<AssignmentStatus>(entry, nameof(Assignment.Status)))
                        : null);
                break;

            case Submission submission:
                yield return new RealtimeSignal(
                    RealtimeKinds.Assignment, submission.OrganizationId, submission.BranchId, submission.CategoryId,
                    submission.AssignmentId, [submission.SubmittedById]);
                break;

            case Review review:
                yield return new RealtimeSignal(
                    RealtimeKinds.Assignment, review.OrganizationId, review.BranchId, review.CategoryId,
                    review.AssignmentId, []);
                break;

            case User user:
                yield return new RealtimeSignal(
                    RealtimeKinds.User, user.OrganizationId, user.BranchId, user.CategoryId, user.Id, [user.Id]);

                // Moved to another branch or category: the team they left must drop them too.
                if (entry.State == EntityState.Modified)
                {
                    var previousBranch = Original<Guid>(entry, nameof(User.BranchId));
                    var previousCategory = Original<Guid>(entry, nameof(User.CategoryId));

                    if (previousBranch != user.BranchId || previousCategory != user.CategoryId)
                    {
                        yield return new RealtimeSignal(
                            RealtimeKinds.User, user.OrganizationId, previousBranch, previousCategory, user.Id, []);
                    }
                }

                break;

            case Category category:
                yield return new RealtimeSignal(
                    RealtimeKinds.Category, category.OrganizationId, category.BranchId, category.Id, category.Id, []);
                break;

            case CategorySettings settings:
                yield return new RealtimeSignal(
                    RealtimeKinds.Category, settings.OrganizationId, settings.BranchId, settings.CategoryId, settings.CategoryId, []);
                break;

            case Branch branch:
                yield return new RealtimeSignal(
                    RealtimeKinds.Branch, branch.OrganizationId, branch.Id, null, branch.Id, []);
                break;

            // Category deliberately dropped: delivery status is an administrator's view, not a Lead's.
            case NotificationOutbox notification:
                yield return new RealtimeSignal(
                    RealtimeKinds.Notification, notification.OrganizationId, notification.BranchId, null, notification.Id, []);
                break;

            case Topic topic:
                yield return new RealtimeSignal(
                    RealtimeKinds.Schedule, topic.OrganizationId, topic.BranchId, topic.CategoryId, topic.Id, []);
                break;

            case TopicAssignment template:
                yield return new RealtimeSignal(
                    RealtimeKinds.Schedule, template.OrganizationId, template.BranchId, template.CategoryId, template.TopicId, []);
                break;
        }
    }

    private static T? Original<T>(EntityEntry entry, string property)
        where T : struct =>
        entry.Property(property).OriginalValue as T?;

    /// <remarks>
    /// A mentor is signalled exactly when the change is visible in their own list, which hides
    /// <c>Draft</c> and <c>Suggested</c> (the Mentor read scope in <c>AssignmentService</c>): the
    /// current assignee if the assignment is visible now, the previous one if it was visible before.
    /// Otherwise a Lead's unpublished draft would announce itself to the mentor it is meant for.
    /// </remarks>
    private static RealtimeSignal ForAssignment(
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

        return new RealtimeSignal(
            RealtimeKinds.Assignment,
            assignment.OrganizationId,
            assignment.BranchId,
            assignment.CategoryId,
            assignment.Id,
            users);
    }

    private static bool IsVisibleToMentor(AssignmentStatus status) =>
        status is not (AssignmentStatus.Draft or AssignmentStatus.Suggested);

    private List<RealtimeSignal>? Take(DbContext? context)
    {
        if (context is null || !_pending.TryGetValue(context, out var signals))
        {
            return null;
        }

        _pending.Remove(context);
        return signals;
    }

    private async ValueTask PublishAsync(DbContext context, List<RealtimeSignal> signals)
    {
        var payloads = signals
            .Select(signal => signal.Serialize())
            .Where(payload => System.Text.Encoding.UTF8.GetByteCount(payload) <= RealtimeSignal.MaxPayloadBytes)
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
            logger.LogWarning(exception, "Failed to publish {Count} realtime signal(s).", payloads.Length);
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
            command.Parameters.Add(new NpgsqlParameter("channel", NpgsqlDbType.Text) { Value = RealtimeSignal.Channel });
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
