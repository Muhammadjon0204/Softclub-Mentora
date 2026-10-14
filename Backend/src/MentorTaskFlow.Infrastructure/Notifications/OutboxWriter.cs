using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Tenancy;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Infrastructure.Observability;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MentorTaskFlow.Infrastructure.Notifications;

/// <inheritdoc />
public sealed class OutboxWriter(
    MentorTaskFlowDbContext dbContext,
    IBranchContext branchContext,
    NotificationMetrics metrics,
    IClock clock) : IOutboxWriter
{
    public Task EnqueueAsync(OutboxEntry entry, CancellationToken cancellationToken)
    {
        var branchId = NotificationEventTypes.OrganizationLevelEvents.Contains(entry.EventType)
            ? null
            : branchContext.EffectiveBranchId;

        return AddAsync(entry, branchContext.EffectiveOrganizationId, branchId, cancellationToken);
    }

    public Task EnqueueSystemAsync(
        OutboxEntry entry,
        Guid organizationId,
        Guid? branchId,
        CancellationToken cancellationToken) =>
        AddAsync(entry, organizationId, branchId, cancellationToken);

    /// <summary>
    /// Expands one logical event into the rows its channel policy calls for (18.1).
    /// </summary>
    /// <remarks>
    /// <c>TelegramPreferred</c> is the case worth spelling out: a Telegram row is written when the
    /// recipient has a binding, and an email row when they do not. The absence of a binding is not an
    /// error and not a dead letter — it is counted and the message goes by mail instead, which is
    /// exactly what keeps a person who never connected Telegram from silently receiving nothing
    /// (<c>NTF-001</c>, <c>NTF-002</c>).
    /// </remarks>
    private async Task AddAsync(
        OutboxEntry entry,
        Guid organizationId,
        Guid? branchId,
        CancellationToken cancellationToken)
    {
        var policy = ChannelPolicies.For(entry.EventType);
        var now = clock.UtcNow;
        var payload = await NotificationPayloadEnricher.EnrichAsync(dbContext, entry, now, cancellationToken);

        var recipient = await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == entry.RecipientUserId, cancellationToken);

        var telegramBound = policy is not ChannelPolicy.EmailOnly && recipient?.TelegramChatId is not null;

        var channels = ResolveChannels(policy, telegramBound, entry.EventType).ToList();

        if (recipient is not null && NotificationTopics.For(entry.EventType) is { } topic)
        {
            channels = ApplyPreferences(channels, policy, topic, recipient);
        }

        foreach (var channel in channels)
        {
            var key = DeduplicationKey.Build(
                organizationId,
                branchId,
                entry.EventType,
                entry.EntityId,
                channel,
                entry.Discriminator);

            // The duplicate is skipped rather than allowed to fail: a repeated notification must not
            // roll back the business event it travels with (NTF-009). The unique index remains the
            // final guard for the race this check cannot close.
            if (await ExistsAsync(key, cancellationToken))
            {
                continue;
            }

            dbContext.NotificationOutbox.Add(NotificationOutbox.Enqueue(
                entry.RecipientUserId,
                organizationId,
                branchId,
                entry.CategoryId,
                channel,
                entry.EventType,
                payload,
                key,
                now,
                entry.IsSystemAlert));
        }
    }

    /// <summary>
    /// Checks both the database and the rows already staged in this unit of work.
    /// </summary>
    /// <remarks>
    /// The change tracker matters as much as the table: two enqueues in one transaction — the same
    /// event raised for a recipient twice — would otherwise both pass the database check and collide
    /// at commit.
    /// </remarks>
    private async Task<bool> ExistsAsync(string key, CancellationToken cancellationToken)
    {
        var staged = dbContext.ChangeTracker
            .Entries<NotificationOutbox>()
            .Any(e => e.State is EntityState.Added && e.Entity.DeduplicationKey == key);

        return staged || await dbContext.NotificationOutbox
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(n => n.DeduplicationKey == key, cancellationToken);
    }

    private IEnumerable<NotificationChannel> ResolveChannels(
        ChannelPolicy policy,
        bool telegramBound,
        string eventType)
    {
        switch (policy)
        {
            case ChannelPolicy.EmailOnly:
                yield return NotificationChannel.Email;
                break;

            case ChannelPolicy.TelegramPreferred:
                if (telegramBound)
                {
                    yield return NotificationChannel.Telegram;
                }
                else
                {
                    metrics.SkippedTelegram(eventType);
                    yield return NotificationChannel.Email;
                }

                break;

            case ChannelPolicy.TelegramOnly:
                if (telegramBound)
                {
                    yield return NotificationChannel.Telegram;
                }
                else
                {
                    metrics.SkippedTelegram(eventType);
                }

                break;

            case ChannelPolicy.Both:
                yield return NotificationChannel.Email;

                // NTF-001: no Telegram row without a binding. Writing one would guarantee a failure
                // that is neither the sender's fault nor worth retrying.
                if (telegramBound)
                {
                    yield return NotificationChannel.Telegram;
                }
                else
                {
                    metrics.SkippedTelegram(eventType);
                }

                break;
        }
    }

    /// <summary>
    /// Drops the channels the recipient switched off on their profile page.
    /// </summary>
    /// <remarks>
    /// <c>TelegramPreferred</c> keeps its promise of reaching the person: if they turned the Telegram
    /// copy off but still want email, the message goes by mail instead of vanishing. Switching both
    /// off is an explicit choice and is honoured. Events without a topic never reach this method —
    /// see <see cref="NotificationTopics.For"/>.
    /// </remarks>
    private static List<NotificationChannel> ApplyPreferences(
        List<NotificationChannel> channels,
        ChannelPolicy policy,
        NotificationTopic topic,
        Domain.Users.User recipient)
    {
        var kept = channels.Where(channel => recipient.WantsNotification(topic, channel)).ToList();

        if (policy is ChannelPolicy.TelegramPreferred
            && channels.Contains(NotificationChannel.Telegram)
            && !kept.Contains(NotificationChannel.Telegram)
            && !kept.Contains(NotificationChannel.Email)
            && recipient.WantsNotification(topic, NotificationChannel.Email))
        {
            kept.Add(NotificationChannel.Email);
        }

        return kept;
    }
}
