using System.ComponentModel.DataAnnotations;

namespace MentorTaskFlow.Infrastructure.Options;

/// <summary>
/// Database configuration. Validated at startup — a missing or malformed value aborts the boot with a
/// readable message rather than falling back to an unsafe default (<c>DEPLOY-015</c>).
/// </summary>
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>
    /// Runs <c>Database.Migrate()</c> during API startup. Allowed only in Development.
    /// In Test, Staging and Production migrations are applied exclusively by the <c>mtf-migrator</c>
    /// container, because several API replicas starting at once would race for schema locks
    /// (<c>DEPLOY-016</c>). Enforced by <see cref="DatabaseOptionsValidator"/>.
    /// </summary>
    public bool MigrateOnStartup { get; init; }

    /// <summary>
    /// Database role the API and the worker connect as — the one the migrator grants the scheduler
    /// schema to (<c>DEPLOY-017</c>).
    /// </summary>
    /// <remarks>
    /// Read only by the migrator, and only to build a <c>GRANT</c>. It is a role name, so it is
    /// interpolated into DDL that cannot be parameterised; the pattern keeps it to what PostgreSQL
    /// accepts unquoted, which is also what makes the interpolation safe.
    /// </remarks>
    [Required(AllowEmptyStrings = false)]
    [RegularExpression("^[A-Za-z_][A-Za-z0-9_]*$")]
    public string ApplicationRole { get; init; } = "mentortaskflow_app";

    [Range(1, 300)]
    public int CommandTimeoutSeconds { get; init; } = 30;

    [Range(0, 10)]
    public int MaxRetryCount { get; init; } = 3;
}
