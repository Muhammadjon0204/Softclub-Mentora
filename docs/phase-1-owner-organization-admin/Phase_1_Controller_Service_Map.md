# Phase 1 Controller / Service Map

Все сигнатуры ниже — рекомендации в Markdown-блоках, **не файлы `.cs`**. Полные HTTP-детали (маршрут, DTO, коды ошибок) — [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md); здесь фиксируется распределение ответственности между Controller, Application Service, доменной моделью, Audit/Outbox.

---

## AuthController

### POST /auth/login
Application service: `IAuthService.LoginAsync`
Input: `LoginRequest` → Output: `AuthLoginResponseDto`
Policy: анонимно
Transaction: 1) найти пользователя по `NormalizedEmail`; 2) проверить lockout/`PasswordHash`; 3) проверить пароль; 4) сбросить `FailedLoginCount`/увеличить при неудаче; 5) выдать access token + refresh token (cookie); 6) `AuditLog(auth.login, success|failure)`.

### POST /auth/refresh
Service: `IAuthService.RefreshAsync` — ротация токена, reuse detection (`AUTH-007`, `AUTH-008`).

### POST /auth/logout
Service: `IAuthService.LogoutAsync` — отзыв refresh-токена, очистка cookie, `AuditLog(auth.logout)`.

### GET /auth/me
Service: `IAuthService.GetCurrentUserAsync` — без побочных эффектов.

### POST /auth/change-password
Service: `IAuthService.ChangePasswordAsync` — проверка текущего пароля, `TokenVersion++`, отзыв прочих сессий, новая пара токенов для текущей сессии, `AuditLog(auth.change_password)`.

### POST /auth/forgot-password, /reset-password, /set-password
Service: `IPasswordResetService.{RequestReset,Reset,SetInitialPassword}Async` — работа с `UserSecurityToken`, всегда 202/200 без раскрытия существования email (`AUTH-015`).

### POST /telegram/bind-token, GET /telegram/status, DELETE /telegram/binding
Service: `ITelegramSelfServiceService.{IssueBindToken,GetStatus,Unbind}Async` — только для собственного профиля вызывающего.

---

## OrganizationController

### GET /organization
Application service: `IOrganizationService.GetCurrentAsync`
Policy: `RequireAuthenticated`
Output: `OrganizationDto` (Organization Admin) или `OrganizationSummaryDto` (остальные) — service сам решает состав по роли вызывающего, Controller не дублирует эту логику.

### PUT /organization
Application service: `IOrganizationService.UpdateAsync`
Policy: `OrganizationAdminOnly`
Transaction:
1. загрузить Organization по `EffectiveOrganizationId` из контекста (никогда из тела запроса);
2. проверить `concurrencyToken`;
3. пересчитать `NormalizedName` сервером;
4. `UPDATE`;
5. `AuditLog(organization.update, BranchId=null)`.

```csharp
Task<OrganizationDto> UpdateAsync(Guid organizationId, UpdateOrganizationCommand command, CancellationToken ct);
```

---

## BranchesController

### GET /branches
Service: `IBranchService.ListAsync` — Policy: `OrganizationAdminOnly` (403 для остальных ролей, `BRN-006`).

### GET /branches/{id}
Service: `IBranchService.GetByIdAsync` — Policy: `RequireAuthenticated`, service возвращает `BranchDto` только Organization Admin своей Organization, `BranchSummaryDto` для BA/L/M только по собственному `id` (иначе 404, `BRN-008`).

### POST /branches
Application service: `IBranchService.CreateAsync`
Policy: `OrganizationAdminOnly`
Input: `CreateBranchRequest{name,code,address?,timeZoneId}` — **без** `organizationId`, **без** `isHeadOffice` (`API-031`).
Transaction:
1. `OrganizationId` = из claims;
2. `NormalizedName` сервером;
3. `IsHeadOffice=false`, `IsActive=true`;
4. валидация `timeZoneId` по IANA tzdata;
5. `INSERT`, уникальность `(organization_id, code)`/`(organization_id, normalized_name)` → 409 `BRANCH_ALREADY_EXISTS`;
6. `AuditLog(branch.create, BranchId=null)`.

```csharp
Task<BranchDto> CreateAsync(Guid actorOrganizationId, CreateBranchCommand command, CancellationToken ct);
```

### PUT /branches/{id}
Service: `IBranchService.UpdateAsync` — Policy: `OrganizationAdminOnly`. `code` изменяемое поле по контракту ТЗ (`BRN-002` перечисляет `name,code,address,timeZoneId`), но Frontend не даёт редактировать `code` в UI — backend не обязан искусственно запрещать смену `code` через API, если её потребует другой клиент; проверить с Product, должен ли backend **дополнительно** запрещать смену `code` после создания (открытый вопрос, см. Phase_1_Product_Extensions_and_Open_Questions.md).

### POST /branches/{id}/activate, /deactivate
Service: `IBranchService.{Activate,Deactivate}Async`. Deactivate: проверка `confirmActiveUsers`, единый порядок — проверка блокировки `HEAD_OFFICE_DEACTIVATION_FORBIDDEN` **до** проверки активных пользователей (приоритет по разделу 39.2/39.3).

### POST /branches/{id}/make-head-office
Service: `IBranchService.MakeHeadOfficeAsync`
Transaction (обязательный порядок, `BRN-035`):
```
SELECT ... FROM organizations WHERE id=@org FOR UPDATE;
UPDATE branches SET is_head_office=false WHERE organization_id=@org AND is_head_office=true;
UPDATE branches SET is_head_office=true  WHERE id=@target;
INSERT AuditLog(branch.make_head_office, metadata: {previousHeadOfficeId, newHeadOfficeId});
```

---

## UsersController

### GET /users, GET /users/{id}
Service: `IUserQueryService.{List,GetById}Async` — Policy: `AdminOrLead` с scope-фильтром по контуру.

### POST /users
Application service: `IUserManagementService.CreateAsync`
Policy: `OrganizationAdminOrScopedBranchAdminOrLead`
Input: `CreateUserRequest`
Output: `UserDetailsDto`

Контракт полностью поддерживает создание Organization Admin другим Organization Admin (`USER-031`, без заголовка `X-MTF-Branch-Id`) — это не блокируется тем, что текущая Frontend-форма создания предлагает только `BranchAdmin|Lead|Mentor`; ограничение принадлежит UI, а не этому Application Service (см. Phase_1_Product_Extensions_and_Open_Questions.md §3.0).

Transaction:
1. проверить scope актора (Lead создаёт только Mentor своей категории; BA — Lead/Mentor своего Branch; OA — любую роль выбранного Branch, либо OA без BH);
2. нормализовать email, проверить глобальную уникальность (`ux_users_normalized_email`);
3. `OrganizationId`/`BranchId`/`CategoryId`/`AdminScope` — вычислить сервером по правилам `USER-032` (никогда из части тела, которая не разрешена данному актору);
4. `INSERT User(PasswordHash=NULL)`;
5. `INSERT UserSecurityToken(Purpose=SetPassword, TTL 24h)`;
6. `INSERT AuditLog(user.create)` с полным scope (`USER-035`);
7. `INSERT NotificationOutbox(invitation email)`;
8. commit.

```csharp
Task<UserDetailsDto> CreateAsync(CurrentActor actor, CreateUserCommand command, CancellationToken ct);
```

### PATCH /users/{id}
Service: `IUserManagementService.UpdateProfileAsync` — только `fullName` по контракту ТЗ (`API-009`); поле `notificationLanguage`, присутствующее в UI-форме, требует Product Decision (добавлять ли в `User` или хранить отдельно) — см. открытый вопрос.

### POST /users/{id}/activate, /deactivate
Service: `IUserManagementService.{Activate,Deactivate}Async`.
Deactivate — транзакция: `UPDATE IsActive=false` → отзыв всех `RefreshToken(Deactivated)` → `TokenVersion++` → инвалидация активных `UserSecurityToken` → `AuditLog(user.deactivate)` → условно `NotificationOutbox(CategoryWithoutLead|BranchWithoutAdmin)`.

**UI-действия «Block»/«Unblock»**: модель не финализирована (`Req. classification = PRODUCT-APPROVED EXTENSION`, `Decision status = PRODUCT DECISION REQUIRED` — см. Phase_1_Product_Extensions_and_Open_Questions.md §3.3). Один из кандидатов — маппинг на эти же методы сервиса с дополнительным `reasonCategory` в `AuditLog.Metadata`; альтернатива — отдельный `UserStatus` с собственным `IUserManagementService.BlockAsync`, если Product подтвердит, что Block семантически отличается от Deactivate. Не создавайте `BlockAsync` до получения ответа — реализуйте только `ActivateAsync`/`DeactivateAsync` в их определённом ТЗ виде.

### POST /users/{id}/change-role
Service: `IUserManagementService.ChangeRoleAsync`
Transaction: валидация перехода (`Mentor→Lead` требует отсутствия активного Lead категории; переход в `Admin` обнуляет `CategoryId`; переход из `Admin` требует `categoryId`) → `UPDATE` → `TokenVersion++` → отзыв RefreshToken(`RoleChanged`/`AdminScopeChanged`) → `AuditLog(user.change_role)`.

### POST /users/{id}/change-category
Service: `IUserManagementService.ChangeCategoryAsync` — блокировка по незавершённым Assignment (`CATEGORY_CHANGE_BLOCKED`), см. `USER-012`.

### POST /users/{id}/change-branch
Application service: `IUserBranchTransferService.TransferAsync`
Policy: `OrganizationAdminOnly`
Transaction — точная последовательность из 10 шагов, `BRN-048` (см. [Phase_1_Owner_Organization_Admin_Backend_Handoff.md](./Phase_1_Owner_Organization_Admin_Backend_Handoff.md) раздел 10). Это самая сложная транзакция Phase 1 — рекомендуется отдельный domain service, не встраивать в общий `IUserManagementService`.

```csharp
Task<UserDetailsDto> TransferAsync(Guid actorId, Guid userId, TransferUserBranchCommand command, CancellationToken ct);
```

### POST /users/{id}/resend-invitation
Service: `IUserInvitationService.ResendAsync` — инвалидирует прежний `SetPassword`-токен, выпускает новый. Расширение для `ResetPassword`-варианта (открытый вопрос U13) — тот же сервис, дополнительный метод `IUserInvitationService.SendPasswordResetAsync`, не переиспользовать `POST /auth/forgot-password` (тот анонимный и не идентифицирует actor'а в AuditLog).

---

## CategoriesController

### GET /categories, GET /categories/{id}, GET /categories/{id}/settings
Service: `ICategoryQueryService.{List,GetById,GetSettings}Async`.

### POST /categories
Application service: `ICategoryManagementService.CreateAsync`
Policy: `OrganizationAdminOrScopedBranchAdmin`
Transaction: 1) определить `OrganizationId`/`BranchId` сервером (BA — из claim, OA — из `X-MTF-Branch-Id`); 2) `INSERT Category`; 3) `INSERT CategorySettings(TimeZoneId=Branch.TimeZoneId, остальное — default)`; 4) `AuditLog(category.create)`.

### PUT /categories/{id}
Service: `ICategoryManagementService.UpdateAsync` — `name`, `description`.

### PUT /categories/{id}/settings
Service: `ICategorySettingsService.UpdateAsync` — валидация диапазонов (`DefaultAssignmentDueDays` 1–60, `DeadlineReminderHours` 1–168), `timeZoneId` по IANA, перерегистрация задач планировщика для `Topic`/авто-генерации категории.

### POST /categories/{id}/activate, /deactivate
Service: `ICategoryManagementService.{Activate,Deactivate}Async` — deactivate требует `confirmActiveUsers`, если есть активные пользователи (`CATEGORY_HAS_ACTIVE_USERS`).

Назначение/смена Lead **не имеет отдельного Category-эндпоинта** — используется `UsersController.ChangeRole` с `CategoryId` целевой категории (см. выше C8 в каталоге).

---

## AssignmentsController (read-only + force-cancel)

### GET /assignments, GET /assignments/{id}, GET /assignments/{id}/history
Service: `IAssignmentQueryService.{List,GetById,GetHistory}Async` — Policy: `RequireAuthenticated` со scope-фильтром по роли (Admin видит `GET`/`cancel` и ничего больше среди мутаций — `TZ-035` явное ограничение).

### GET /assignments/{id}/submissions, GET /submissions/{id}/review
Service: `ISubmissionQueryService.{ListByAssignment,GetReview}Async`.

### GET /submissions/{id}/download-url, /preview-url
Application service: `IFileAccessService.{GetDownloadUrl,GetPreviewUrl}Async`
Transaction: полная повторная проверка уровней 1–5 (`SEC-004`) → генерация presigned URL (TTL 10 мин) → `Cache-Control: no-store`, URL не логируется.

```csharp
Task<SignedUrlDto> GetDownloadUrlAsync(CurrentActor actor, Guid submissionId, CancellationToken ct);
```

### POST /assignments/{id}/cancel (force-cancel)
Application service: `IAssignmentAdminActionsService.ForceCancelAsync`
Policy: `OrganizationAdminOrScopedBranchAdmin` (единственная мутация Assignment, доступная Admin, `ASN-025`)
Transaction:
1. загрузить Assignment по effective scope, проверить `concurrencyToken`;
2. domain-метод `Assignment.Cancel(reason, forceCancel:true)` — единственная точка изменения `Status` (`ASN-022`, прямое присвоение `Status` запрещено);
3. `INSERT TaskEvent(Cancelled, metadata:{cancelledById, cancelReason, forceCancel:true})`;
4. если Assignment был опубликован — `INSERT NotificationOutbox(AssignmentCancelled)` для Mentor;
5. `INSERT AuditLog(assignment.force_cancel)`;
6. commit.

```csharp
Task<AssignmentDto> ForceCancelAsync(CurrentActor actor, Guid assignmentId, ForceCancelAssignmentCommand command, CancellationToken ct);
```

Ни один другой domain-метод Assignment (`Publish`, `AcceptSuggestion`, `Reassign`, `StartReview`) не должен быть доступен через policy, применяемую к Admin — это архитектурный инвариант, а не просто отсутствие кнопки (`ASN-025`, раздел 23.4 «Явное ограничение Admin»).

---

## NotificationsController

### GET /admin/notifications, GET /admin/notifications/{id}
Service: `INotificationOutboxQueryService.{List,GetById}Async` — payload очищен от provider secrets перед сериализацией в DTO.

### POST /admin/notifications/{id}/retry
Application service: `INotificationRetryService.RetryAsync`
Policy: `OrganizationAdminOrScopedBranchAdmin`
Transaction: проверить `Status='DeadLetter'` (иначе 409) → `UPDATE Status='Pending', Attempts=0, NextAttemptAt=now()` → `AuditLog(notification.retry)`. История прошлых попыток не удаляется — хранится в отдельном append-only логе попыток или в `AuditLog`, не в перезаписываемом поле.

---

## AuditController

### GET /admin/audit-log
Service: `IAuditLogQueryService.ListAsync`
Policy: `OrganizationAdminOrScopedBranchAdmin` — OA видит Organization-level записи (`BranchId IS NULL`), BA — нет (`TEN-049`).
Side effect: сам вызов создаёт `AuditLog(audit.read, metadata:{branchFilter, adminScope})` (`AUD-023`) — Controller обязан вызвать `IAuditLogWriter` **после** успешного выполнения запроса, не до.

---

## ReportsController

### GET /reports/personal, GET /reports/team, GET /reports/branches
Service: `IAnalyticsQueryService.{GetPersonal,GetTeam,CompareBranches}Async` — формулы исключительно по разделу 21 ТЗ; группировка по `(BranchId, CategoryId)`, никогда по `Category.Name` (`TEN-071`).

### POST /reports/ai-summary
Application service: `IAiSummaryService.GenerateOrGetCachedAsync`
Transaction: проверить кэш по `CacheKey` (включает scope) → если нет/`forceRegenerate` и лимит `AI__FORCE_REGENERATION_PER_DAY` не превышен → вызвать провайдера с бюджетом времени 90с → сохранить `AiSummary` → `AuditLog(report.ai_summary_generated)`. При недоступности провайдера — 503 `AI_PROVIDER_UNAVAILABLE`, не блокирует остальную аналитику страницы (`AI-018`).

**Экспорт отчёта — endpoint пока не создаётся.** `Req. classification = PRODUCT-APPROVED EXTENSION` (владелец продукта подтвердил полезность функции в текущем UI), `Decision status = PRODUCT DECISION REQUIRED` (маршрут/формат/синхронность не спроектированы, раздел 5 ТЗ ещё не обновлён). Реализация начинается только после формальной правки ТЗ и проектирования контракта, а не тихо вопреки текущей редакции — см. Phase_1_Product_Extensions_and_Open_Questions.md §1.5.

---

## HealthController

### GET /health/live, GET /health/ready, GET /metrics
Service: `IHealthCheckService` (стандартный ASP.NET Core `HealthCheckService` + классификация зависимостей по `OBS-004`); `GET /metrics` — стандартный Prometheus exporter middleware, не кастомный Controller-метод.

История инцидентов (`IncidentHistoryModal`) — не отдельный сервис; переиспользует `IAuditLogQueryService.ListAsync` с фильтром по `Action IN ('OrganizationSystemAlert','NotificationDeadLetter', ...)`, пока Product не подтвердит необходимость отдельной сущности.

---

## Общие Application Service интерфейсы, используемые несколькими Controller

```csharp
public interface ICurrentActor
{
    Guid UserId { get; }
    Role Role { get; }
    AdminScope? AdminScope { get; }
    Guid OrganizationId { get; }
    Guid? BranchId { get; }
    Guid? CategoryId { get; }
}

public interface IBranchScopeResolver
{
    // Разрешает effective BranchId по заголовку X-MTF-Branch-Id для Organization Admin;
    // выбрасывает InvalidBranchContextException -> 400 BRANCH_CONTEXT_REQUIRED,
    // ScopeOverrideException -> 403 SCOPE_OVERRIDE_FORBIDDEN,
    // BranchNotFoundException -> 404 RESOURCE_NOT_FOUND.
    Task<BranchScope> ResolveAsync(HttpContext context, CancellationToken ct);
}

public interface IAuditLogWriter
{
    Task WriteAsync(AuditLogEntry entry, CancellationToken ct); // всегда внутри той же транзакции, что и бизнес-мутация
}

public interface INotificationOutboxWriter
{
    Task EnqueueAsync(NotificationOutboxEntry entry, CancellationToken ct); // transactional outbox, NTF-009
}
```

Каждый Application Service Phase 1 обязан принимать `ICurrentActor`, а не читать `HttpContext` напрямую (тестируемость, единая точка scope-проверки, `SEC-030`).
