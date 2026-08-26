using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Security;
using MentorTaskFlow.Domain.Auditing;
using MentorTaskFlow.Domain.Categories;
using MentorTaskFlow.Domain.Common;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Tenancy;
using MentorTaskFlow.Domain.Users;
using MentorTaskFlow.Infrastructure.Options;
using MentorTaskFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Infrastructure.Identity;

/// <summary>Outcome of a provisioning attempt.</summary>
public sealed record BootstrapResult(bool Provisioned, string? SetPasswordLink, string? SkipReason);

/// <summary>
/// Creates the first organization, its head office and the first administrator (TZ 32.6).
/// </summary>
/// <remarks>
/// <para>
/// Runs once from the <c>mtf-migrator</c> container against an empty <c>organizations</c> table; with
/// any organization present the step is skipped (<c>DEPLOY-022</c>).
/// </para>
/// <para>
/// The first administrator is an <b>Organization</b> Admin, not an administrator of the head office.
/// An admin pinned to a branch could not create a second branch, and the organization would be stuck
/// on one branch with no way to grow (<c>DEPLOY-031</c>).
/// </para>
/// </remarks>
public sealed class BootstrapProvisioner(
    MentorTaskFlowDbContext dbContext,
    AuthService authService,
    IAuditWriter auditWriter,
    IOutboxWriter outboxWriter,
    IPasswordHasher passwordHasher,
    IHostEnvironment environment,
    IOptions<BootstrapOptions> options,
    IClock clock,
    ILogger<BootstrapProvisioner> logger)
{
    private readonly BootstrapOptions _options = options.Value;

    public Task<BootstrapResult> ProvisionAsync(CancellationToken cancellationToken)
    {
        if (!_options.IsComplete)
        {
            return Task.FromResult(new BootstrapResult(false, null, "Bootstrap configuration is incomplete."));
        }

        // The connection is configured with EnableRetryOnFailure, and a retrying execution strategy
        // refuses a user-initiated transaction unless the whole unit is handed to it: on a transient
        // failure it has to replay everything, and it cannot replay a transaction it does not own.
        // Without this wrapper the provisioning below throws before touching the database.
        var strategy = dbContext.Database.CreateExecutionStrategy();

        return strategy.ExecuteAsync(() => ProvisionCoreAsync(cancellationToken));
    }

    private async Task<BootstrapResult> ProvisionCoreAsync(CancellationToken cancellationToken)
    {
        // Cleared on entry rather than once at the top: the execution strategy may replay this whole
        // method, and entities staged by a failed attempt would otherwise be inserted twice.
        //
        // The tenant filter is suppressed for the duration — provisioning is one of the registered
        // system tasks of SEC-031, running with no principal, and must see the whole table to decide
        // whether to act at all.
        dbContext.ChangeTracker.Clear();

        if (await dbContext.Organizations.IgnoreQueryFilters().AnyAsync(cancellationToken))
        {
            if (environment.IsDevelopment() && !string.IsNullOrWhiteSpace(_options.DevelopmentPassword))
            {
                await ProvisionDevelopmentDatasetAsync(cancellationToken);
            }

            return new BootstrapResult(false, null, "An organization already exists; bootstrap skipped.");
        }

        var now = clock.UtcNow;

        // One transaction for the whole set. A partial result — an organization with no head office,
        // or an administrator with no way to set a password — is worse than no result at all
        // (DEPLOY-030, BRN-028).
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var organization = Organization.Provision(_options.OrganizationName!, _options.OrganizationSlug!, now);
            dbContext.Organizations.Add(organization);

            var headOffice = Branch.CreateHeadOffice(
                organization.Id,
                _options.HeadOfficeName!,
                _options.HeadOfficeCode!,
                address: null,
                _options.HeadOfficeTimeZone!,
                now);
            dbContext.Branches.Add(headOffice);

            var admin = User.CreateOrganizationAdmin(
                organization.Id,
                "Администратор организации",
                _options.AdminEmail!,
                now);
            dbContext.Users.Add(admin);

            await dbContext.SaveChangesAsync(cancellationToken);

            var setPasswordLink = await authService.IssueSetPasswordLinkAsync(admin, ipAddress: null, cancellationToken);

            // Steps 5 and 6 of DEPLOY-030. Both carry BranchId = NULL: the first administrator is an
            // Organization Admin who belongs to no branch, so the invitation and the provisioning
            // record are organization-level by construction (TEN-042, TEN-048).
            await outboxWriter.EnqueueSystemAsync(
                new OutboxEntry
                {
                    RecipientUserId = admin.Id,
                    EventType = NotificationEventTypes.UserInvitation,
                    EntityId = admin.Id,

                    // The payload names the organization but carries no token and no link: NTF-017
                    // forbids putting either in a notification payload, and the renderer builds the
                    // link from the security token when it sends.
                    Payload = JsonSerializer.SerializeToDocument(new
                    {
                        organizationName = organization.Name,
                        fullName = admin.FullName,
                    }),
                },
                organization.Id,
                branchId: null,
                cancellationToken);

            auditWriter.WriteSystem(
                new AuditEntry
                {
                    Action = AuditActions.BootstrapProvision,
                    EntityType = nameof(Organization),
                    EntityId = organization.Id,
                    Metadata = JsonSerializer.SerializeToDocument(new
                    {
                        organizationSlug = organization.Slug,
                        headOfficeCode = headOffice.Code,
                    }),
                },
                organization.Id,
                branchId: null);

            await dbContext.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            if (environment.IsDevelopment() && !string.IsNullOrWhiteSpace(_options.DevelopmentPassword))
            {
                await ProvisionDevelopmentDatasetAsync(cancellationToken);
            }

            // DEPLOY-024: the link is written to the migrator container log exactly once. Organization
            // and branch identifiers are deliberately absent from that line.
            logger.LogWarning(
                "Bootstrap complete. Set the first administrator password using this one-time link: {SetPasswordLink}",
                setPasswordLink);

            return new BootstrapResult(true, setPasswordLink, null);
        }
        catch (DbUpdateException exception)
        {
            await transaction.RollbackAsync(cancellationToken);

            // Two migrator containers starting at once: the unique indexes ux_organizations_slug,
            // ux_branches_organization_code and ux_users_normalized_email are the final guard, and the
            // loser rolls back whole rather than leaving a half-provisioned tenant (DEPLOY-032).
            logger.LogInformation(
                exception,
                "Bootstrap lost a race with a concurrent provisioning run; no changes were applied.");

            return new BootstrapResult(false, null, "Concurrent bootstrap detected; this run made no changes.");
        }
    }

    private async Task ProvisionDevelopmentDatasetAsync(CancellationToken cancellationToken)
    {
        var organization = await dbContext.Organizations
            .IgnoreQueryFilters()
            .SingleAsync(cancellationToken);
        var now = clock.UtcNow;

        if (!string.Equals(organization.Name, _options.OrganizationName, StringComparison.Ordinal))
        {
            organization.Rename(_options.OrganizationName!, now);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var branch = await dbContext.Branches
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(
                item => item.OrganizationId == organization.Id
                    && item.NormalizedName == Normalization.ToNormalized("Филиал Профсоюз"),
                cancellationToken);

        if (branch is null)
        {
            branch = await dbContext.Branches
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(
                    item => item.OrganizationId == organization.Id && item.IsHeadOffice,
                    cancellationToken);

            if (branch is not null)
            {
                branch.Update("Филиал Профсоюз", "PROFSOYUZ", address: null, "Asia/Dushanbe", now);
            }
            else
            {
                branch = Branch.Create(
                    organization.Id,
                    "Филиал Профсоюз",
                    "PROFSOYUZ",
                    address: null,
                    "Asia/Dushanbe",
                    now);
                dbContext.Branches.Add(branch);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var category = await dbContext.Categories
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(
                item => item.OrganizationId == organization.Id
                    && item.BranchId == branch.Id
                    && item.NormalizedName == Normalization.ToNormalized("C#"),
                cancellationToken);

        if (category is null)
        {
            category = Category.Create(organization.Id, branch.Id, "C#", null, now);
            dbContext.Categories.Add(category);
            dbContext.CategorySettings.Add(CategorySettings.CreateDefault(category, branch.TimeZoneId, now));
        }

        var passwordHash = passwordHasher.Hash(_options.DevelopmentPassword!);
        var users = new (string Email, string Name, UserRole Role)[]
        {
            ("nurulloadmin@gmail.com", "Nurul Loadmin", UserRole.Admin),
            ("shamsudinzoda.n9@gmail.com", "Shamsudinzoda", UserRole.Admin),
            ("alijonzabirov20@mail.ru", "Alijon Zabirov", UserRole.Lead),
            ("kosimovmuhamadjon23@gmail.com", "Kosimov Muhamadjon", UserRole.Mentor),
            ("samsiddinarbobov@gmail.com", "Samsiddin Arbobov", UserRole.Mentor),
        };

        foreach (var seed in users)
        {
            var normalizedEmail = Normalization.ToNormalized(seed.Email);
            var user = await dbContext.Users
                .IgnoreQueryFilters()
                .SingleOrDefaultAsync(item => item.NormalizedEmail == normalizedEmail, cancellationToken);

            if (user is null)
            {
                user = seed.Role == UserRole.Admin
                    ? (seed.Email == "nurulloadmin@gmail.com"
                        ? User.CreateOrganizationAdmin(organization.Id, seed.Name, seed.Email, now)
                        : User.CreateBranchAdmin(organization.Id, branch.Id, seed.Name, seed.Email, now))
                    : seed.Role == UserRole.Lead
                        ? User.CreateLead(organization.Id, branch.Id, category.Id, seed.Name, seed.Email, now)
                        : User.CreateMentor(organization.Id, branch.Id, category.Id, seed.Name, seed.Email, now);
                dbContext.Users.Add(user);
            }

            if (user.PasswordHash is null || !passwordHasher.Verify(_options.DevelopmentPassword!, user.PasswordHash))
            {
                user.SetPasswordHash(passwordHash, now);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
