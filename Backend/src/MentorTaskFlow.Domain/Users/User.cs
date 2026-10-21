using MentorTaskFlow.Domain.Common;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Domain.Tenancy;

namespace MentorTaskFlow.Domain.Users;

/// <summary>
/// A system account (TZ 10.1).
/// </summary>
/// <remarks>
/// <para>
/// The scope fields admit <b>exactly four</b> combinations (<c>USER-023</c>). Anything else is
/// rejected by the CHECK constraints <c>ck_users_scope_shape</c>, <c>ck_users_role_admin_scope</c>
/// and <c>ck_users_role_category</c>; the factories below are the application-side half of that
/// guarantee, never its only half (<c>TEN-023</c>).
/// </para>
/// <list type="table">
///   <item><description>Admin + Organization → OrganizationId, BranchId NULL, CategoryId NULL</description></item>
///   <item><description>Admin + Branch → OrganizationId, BranchId, CategoryId NULL</description></item>
///   <item><description>Lead → OrganizationId, BranchId, CategoryId, AdminScope NULL</description></item>
///   <item><description>Mentor → OrganizationId, BranchId, CategoryId, AdminScope NULL</description></item>
/// </list>
/// </remarks>
public sealed class User : AuditableEntity
{
    public const int FullNameMinLength = 2;
    public const int FullNameMaxLength = 100;
    public const int EmailMaxLength = 254;

    public string FullName { get; private set; } = null!;

    /// <summary>Stored as the user typed it; the uniqueness index uses <see cref="NormalizedEmail"/>.</summary>
    public string Email { get; private set; } = null!;

    /// <summary>
    /// <b>Globally</b> unique, not unique per organization (<c>TEN-028</c>). Login is Email + password
    /// with no tenant selector, so per-organization uniqueness would force either an organization
    /// field on the sign-in form or an ambiguous account resolution. The consequence — one address
    /// cannot be reused across two organizations — is accepted deliberately.
    /// </summary>
    public string NormalizedEmail { get; private set; } = null!;

    /// <summary>
    /// Null until the invitation flow completes. A user in that state cannot sign in: login returns
    /// 401 <c>INVALID_CREDENTIALS</c> without revealing why (<c>USER-021</c>). Generated passwords are
    /// never produced, mailed or displayed (<c>AUTH-019</c>).
    /// </summary>
    public string? PasswordHash { get; private set; }

    public UserRole Role { get; private set; }

    public AdminScope? AdminScope { get; private set; }

    /// <summary>
    /// Required for every role without exception. Immutable: moving a user between organizations is
    /// unsupported and has no endpoint (<c>ORG-023</c>).
    /// </summary>
    public Guid OrganizationId { get; private set; }

    /// <summary>Null only for an Organization Admin. Changed only through <c>change-branch</c> (TZ 39.6).</summary>
    public Guid? BranchId { get; private set; }

    /// <summary>
    /// Required for Lead and Mentor, null for both Admins. When set, the composite FK
    /// <c>fk_users_category_scope</c> guarantees the category belongs to the very same organization
    /// and branch — «a Lead of branch A attached to a category of branch B» is physically impossible
    /// (<c>USER-024</c>).
    /// </summary>
    public Guid? CategoryId { get; private set; }

    public string? TelegramChatId { get; private set; }

    /// <summary>
    /// The mentor in Omuz CRM who is this person, or null while not linked.
    /// </summary>
    /// <remarks>
    /// The CRM's own id, not its phone or name: those change, the id does not. It decides which CRM
    /// groups the person sees — a mentor their own, a Lead their team's — so only an Organization Admin
    /// sets it; a link a person could set on themselves would open someone else's groups.
    /// </remarks>
    public int? CrmMentorId { get; private set; }

    /// <summary>
    /// The person's phone as Telegram confirmed it — digits only, with the country code
    /// (<c>992931234567</c>) — or null. Only ever set from a contact the person shared about
    /// themselves in the bot, never typed in, so it can be trusted to find them in the CRM.
    /// </summary>
    public string? PhoneNumber { get; private set; }

    public const int PhoneNumberMaxLength = 20;

    /// <summary>
    /// File name of the profile photo in storage, or null for the initials avatar.
    /// </summary>
    /// <remarks>
    /// Random and replaced on every upload, never reused: the name is the photo's address, so a new
    /// photo is a new URL and every cache — the browser's, a proxy's — can keep the old one for ever
    /// without ever showing it in place of the new.
    /// </remarks>
    public string? AvatarKey { get; private set; }

    /// <summary>
    /// Incremented on any change to scope or access level: password, role, admin scope, category,
    /// branch, deactivation, refresh-token reuse (<c>AUTH-034</c>). Carried in the access token as
    /// the <c>tv</c> claim, which is what makes revocation effective within 30 seconds.
    /// </summary>
    public int TokenVersion { get; private set; }

    public bool IsActive { get; private set; }

    public int FailedLoginCount { get; private set; }

    public DateTimeOffset? LockoutUntil { get; private set; }

    public DateTimeOffset? LastLoginAt { get; private set; }

    // Personal notification settings: one switch per topic and channel (profile page). Everything is
    // on by default, so a person who never opens the page gets exactly what they got before.
    public bool NotifyAssignmentsEmail { get; private set; } = true;
    public bool NotifyAssignmentsTelegram { get; private set; } = true;
    public bool NotifyDeadlinesEmail { get; private set; } = true;
    public bool NotifyDeadlinesTelegram { get; private set; } = true;
    public bool NotifyReviewsEmail { get; private set; } = true;
    public bool NotifyReviewsTelegram { get; private set; } = true;
    public bool NotifySystemEmail { get; private set; } = true;
    public bool NotifySystemTelegram { get; private set; } = true;

    private User()
    {
    }

    /// <summary>Organization Admin: the whole organization, bound to no branch and no category.</summary>
    public static User CreateOrganizationAdmin(Guid organizationId, string fullName, string email, DateTimeOffset now) =>
        Create(organizationId, null, null, UserRole.Admin, Tenancy.AdminScope.Organization, fullName, email, now);

    /// <summary>Branch Admin: one branch. Created only by an Organization Admin (<c>USER-031</c>).</summary>
    public static User CreateBranchAdmin(Guid organizationId, Guid branchId, string fullName, string email, DateTimeOffset now) =>
        Create(organizationId, branchId, null, UserRole.Admin, Tenancy.AdminScope.Branch, fullName, email, now);

    /// <summary>
    /// Lead of a category. At most one active Lead may exist per category — enforced by the partial
    /// unique index <c>ux_users_active_lead_per_category</c>, not by a service check (<c>USER-003</c>).
    /// </summary>
    public static User CreateLead(Guid organizationId, Guid branchId, Guid categoryId, string fullName, string email, DateTimeOffset now) =>
        Create(organizationId, branchId, categoryId, UserRole.Lead, null, fullName, email, now);

    public static User CreateMentor(Guid organizationId, Guid branchId, Guid categoryId, string fullName, string email, DateTimeOffset now) =>
        Create(organizationId, branchId, categoryId, UserRole.Mentor, null, fullName, email, now);

    private static User Create(
        Guid organizationId,
        Guid? branchId,
        Guid? categoryId,
        UserRole role,
        AdminScope? adminScope,
        string fullName,
        string email,
        DateTimeOffset now)
    {
        var trimmedName = (fullName ?? string.Empty).Trim();
        var trimmedEmail = (email ?? string.Empty).Trim();

        if (organizationId == Guid.Empty)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "OrganizationId обязателен для всех ролей.");
        }

        if (trimmedName.Length is < FullNameMinLength or > FullNameMaxLength)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"ФИО должно содержать от {FullNameMinLength} до {FullNameMaxLength} символов.");
        }

        if (trimmedEmail.Length is 0 or > EmailMaxLength || !trimmedEmail.Contains('@'))
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Email обязателен и должен быть корректным.");
        }

        EnsureScopeShape(role, adminScope, branchId, categoryId);

        return new User
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            CategoryId = categoryId,
            Role = role,
            AdminScope = adminScope,
            FullName = trimmedName,
            Email = trimmedEmail,
            NormalizedEmail = Normalization.ToNormalized(trimmedEmail),
            PasswordHash = null,
            TokenVersion = 0,
            IsActive = true,
            FailedLoginCount = 0,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    /// <summary>
    /// The application-side mirror of <c>ck_users_scope_shape</c>. Kept as one method so the rule
    /// exists in exactly one place: a second copy would inevitably drift from the CHECK constraint.
    /// </summary>
    public static void EnsureScopeShape(UserRole role, AdminScope? adminScope, Guid? branchId, Guid? categoryId)
    {
        var valid = (role, adminScope) switch
        {
            (UserRole.Admin, Tenancy.AdminScope.Organization) => branchId is null && categoryId is null,
            (UserRole.Admin, Tenancy.AdminScope.Branch) => branchId is not null && categoryId is null,
            (UserRole.Admin, null) => false,
            (UserRole.Lead or UserRole.Mentor, null) => branchId is not null && categoryId is not null,
            (UserRole.Lead or UserRole.Mentor, not null) => false,
            _ => false,
        };

        if (!valid)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                "Недопустимое сочетание Role/AdminScope/BranchId/CategoryId (USER-023).");
        }
    }

    /// <summary>
    /// Changes the display name.
    /// </summary>
    /// <remarks>
    /// Deliberately the only field a generic edit may touch. Role, scope and activity each carry
    /// consequences a rename does not — token revocation, history rows, notifications — so each has
    /// its own operation (<c>API-009</c>). The email is not editable either: it is the sign-in
    /// identity and globally unique (<c>TEN-028</c>).
    /// </remarks>
    /// <summary>Sets a new profile photo and returns the previous one's key, for removal from storage.</summary>
    public string? ReplaceAvatar(string avatarKey, DateTimeOffset now)
    {
        if (!IsValidAvatarKey(avatarKey))
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Недопустимое имя файла фотографии.");
        }

        var previous = AvatarKey;
        AvatarKey = avatarKey;
        UpdatedAt = now;
        return previous;
    }

    /// <summary>Back to the initials avatar; returns the removed photo's key, or null if there was none.</summary>
    public string? RemoveAvatar(DateTimeOffset now)
    {
        var previous = AvatarKey;

        if (previous is not null)
        {
            AvatarKey = null;
            UpdatedAt = now;
        }

        return previous;
    }

    /// <summary>
    /// 32 lowercase hex characters and the extension — exactly what the server generates, so nothing a
    /// client sends can become a storage path.
    /// </summary>
    public static bool IsValidAvatarKey(string? key) =>
        key is { Length: <= AvatarKeyMaxLength }
        && System.Text.RegularExpressions.Regex.IsMatch(key, "^[0-9a-f]{32}\\.(webp|jpg)$");

    public const int AvatarKeyMaxLength = 40;

    public void Rename(string fullName, DateTimeOffset now)
    {
        var trimmed = (fullName ?? string.Empty).Trim();

        if (trimmed.Length is < FullNameMinLength or > FullNameMaxLength)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                $"ФИО должно содержать от {FullNameMinLength} до {FullNameMaxLength} символов.");
        }

        FullName = trimmed;
        UpdatedAt = now;
    }

    /// <summary>Sets the first password through the invitation flow, or replaces it on reset.</summary>
    public void SetPasswordHash(string passwordHash, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "PasswordHash не может быть пустым.");
        }

        PasswordHash = passwordHash;
        TokenVersion++;
        FailedLoginCount = 0;
        LockoutUntil = null;
        UpdatedAt = now;
    }

    /// <summary>
    /// Moves the user to another category <b>within the same branch</b> (<c>USER-037</c>). A transfer
    /// that also changes branch is a different operation entirely (TZ 39.6).
    /// </summary>
    public void ChangeCategory(Guid newCategoryId, DateTimeOffset now)
    {
        if (Role is UserRole.Admin)
        {
            throw new DomainException(
                DomainErrorCodes.ValidationFailed,
                "У администратора нет категории; смена категории неприменима.");
        }

        if (newCategoryId == Guid.Empty)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "NewCategoryId обязателен.");
        }

        CategoryId = newCategoryId;
        TokenVersion++;
        UpdatedAt = now;
    }

    /// <summary>
    /// Moves the user to another branch. Historical rows are never re-scoped: assignments,
    /// submissions, reviews and events keep their original branch, so neither branch's analytics is
    /// distorted retroactively (<c>TEN-018</c>).
    /// </summary>
    public void ChangeBranch(Guid newBranchId, Guid? newCategoryId, DateTimeOffset now)
    {
        if (newBranchId == Guid.Empty)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "NewBranchId обязателен.");
        }

        EnsureScopeShape(Role, AdminScope, newBranchId, newCategoryId);

        BranchId = newBranchId;
        CategoryId = newCategoryId;
        TokenVersion++;
        UpdatedAt = now;
    }

    /// <summary>Changes role and, for an Admin, the administrative contour (<c>USER-008</c>, <c>USER-033</c>).</summary>
    public void ChangeRole(UserRole newRole, AdminScope? newAdminScope, Guid? newBranchId, Guid? newCategoryId, DateTimeOffset now)
    {
        EnsureScopeShape(newRole, newAdminScope, newBranchId, newCategoryId);

        Role = newRole;
        AdminScope = newAdminScope;
        BranchId = newBranchId;
        CategoryId = newCategoryId;
        TokenVersion++;
        UpdatedAt = now;
    }

    /// <summary>
    /// Deactivation blocks sign-in. The caller must, in the same transaction, revoke every refresh
    /// token and invalidate active security tokens (<c>USER-004</c>).
    /// </summary>
    public void Deactivate(DateTimeOffset now)
    {
        IsActive = false;
        TokenVersion++;
        UpdatedAt = now;
    }

    public void Activate(DateTimeOffset now)
    {
        IsActive = true;
        UpdatedAt = now;
    }

    /// <summary>Whether this person wants <paramref name="topic"/> on <paramref name="channel"/>.</summary>
    public bool WantsNotification(NotificationTopic topic, NotificationChannel channel) =>
        (topic, channel) switch
        {
            (NotificationTopic.Assignments, NotificationChannel.Email) => NotifyAssignmentsEmail,
            (NotificationTopic.Assignments, NotificationChannel.Telegram) => NotifyAssignmentsTelegram,
            (NotificationTopic.Deadlines, NotificationChannel.Email) => NotifyDeadlinesEmail,
            (NotificationTopic.Deadlines, NotificationChannel.Telegram) => NotifyDeadlinesTelegram,
            (NotificationTopic.Reviews, NotificationChannel.Email) => NotifyReviewsEmail,
            (NotificationTopic.Reviews, NotificationChannel.Telegram) => NotifyReviewsTelegram,
            (NotificationTopic.System, NotificationChannel.Email) => NotifySystemEmail,
            (NotificationTopic.System, NotificationChannel.Telegram) => NotifySystemTelegram,
            _ => true,
        };

    public void SetNotificationPreference(
        NotificationTopic topic,
        NotificationChannel channel,
        bool enabled,
        DateTimeOffset now)
    {
        switch (topic, channel)
        {
            case (NotificationTopic.Assignments, NotificationChannel.Email): NotifyAssignmentsEmail = enabled; break;
            case (NotificationTopic.Assignments, NotificationChannel.Telegram): NotifyAssignmentsTelegram = enabled; break;
            case (NotificationTopic.Deadlines, NotificationChannel.Email): NotifyDeadlinesEmail = enabled; break;
            case (NotificationTopic.Deadlines, NotificationChannel.Telegram): NotifyDeadlinesTelegram = enabled; break;
            case (NotificationTopic.Reviews, NotificationChannel.Email): NotifyReviewsEmail = enabled; break;
            case (NotificationTopic.Reviews, NotificationChannel.Telegram): NotifyReviewsTelegram = enabled; break;
            case (NotificationTopic.System, NotificationChannel.Email): NotifySystemEmail = enabled; break;
            case (NotificationTopic.System, NotificationChannel.Telegram): NotifySystemTelegram = enabled; break;
        }

        UpdatedAt = now;
    }

    public void BindTelegram(string telegramChatId, DateTimeOffset now)
    {
        TelegramChatId = telegramChatId;
        UpdatedAt = now;
    }

    public void UnbindTelegram(DateTimeOffset now)
    {
        TelegramChatId = null;
        UpdatedAt = now;
    }

    /// <summary>Links the person to a CRM mentor, or unlinks them with <c>null</c>.</summary>
    public void LinkCrmMentor(int? crmMentorId, DateTimeOffset now)
    {
        if (crmMentorId is <= 0)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Неверный id ментора в CRM.");
        }

        if (Role is UserRole.Admin && crmMentorId is not null)
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "С ментором CRM связываются только ментор и тимлид.");
        }

        CrmMentorId = crmMentorId;
        UpdatedAt = now;
    }

    /// <summary>Stores a phone confirmed by Telegram (see <see cref="PhoneNumber"/>).</summary>
    public void SetVerifiedPhone(string digits, DateTimeOffset now)
    {
        if (string.IsNullOrEmpty(digits) || digits.Length is < 7 or > PhoneNumberMaxLength || !digits.All(char.IsAsciiDigit))
        {
            throw new DomainException(DomainErrorCodes.ValidationFailed, "Неверный номер телефона.");
        }

        PhoneNumber = digits;
        UpdatedAt = now;
    }

    public void RegisterSuccessfulLogin(DateTimeOffset now)
    {
        FailedLoginCount = 0;
        LockoutUntil = null;
        LastLoginAt = now;
        UpdatedAt = now;
    }

    public void RegisterFailedLogin(int lockoutThreshold, TimeSpan lockoutDuration, DateTimeOffset now)
    {
        FailedLoginCount++;

        if (FailedLoginCount >= lockoutThreshold)
        {
            LockoutUntil = now.Add(lockoutDuration);
        }

        UpdatedAt = now;
    }

    /// <summary>Invalidates every issued token without any other state change (<c>AUTH-027</c>).</summary>
    public void BumpTokenVersion(DateTimeOffset now)
    {
        TokenVersion++;
        UpdatedAt = now;
    }
}
