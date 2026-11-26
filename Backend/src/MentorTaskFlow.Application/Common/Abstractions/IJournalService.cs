using MentorTaskFlow.Contracts.Common;
using MentorTaskFlow.Contracts.Journal;

namespace MentorTaskFlow.Application.Common.Abstractions;

/// <summary>
/// The journal of task lifecycles: everything that happened to the tasks a person can see, with who
/// did it and what changed. Read-only over the append-only task history.
/// </summary>
public interface IJournalService
{
    Task<PagedResult<JournalEntryDto>> ListAsync(JournalQuery query, CancellationToken cancellationToken);
}
