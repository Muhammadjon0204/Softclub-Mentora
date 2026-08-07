# Phase 1 Backend Implementation Checklist

Порядок соответствует разделу 20 [Phase_1_Owner_Organization_Admin_Backend_Handoff.md](./Phase_1_Owner_Organization_Admin_Backend_Handoff.md). Для каждого endpoint контрольные точки: Controller · Service · validation · policy · транзакция · Audit · Outbox · OpenAPI · тесты · Frontend-подключение.

## Foundation

- [ ] `ICurrentActor` / `ICurrentUserContext` — извлечение claims (`sub, role, admin_scope, org_id, branch_id, category_id, tv`)
- [ ] `IBranchContext` / `IBranchScopeResolver` — разбор `X-MTF-Branch-Id`, правила BH (`TEN-032`…`TEN-039`)
- [ ] Global Query Filter по `OrganizationId` (+ `BranchId` где применимо)
- [ ] Явная scope-проверка в каждом handler (не заменяется Global Query Filter, `SEC-030`)
- [ ] Authorization policies: `OrganizationAdminOnly`, `OrganizationAdminOrScopedBranchAdmin`, `RequireAuthenticated`, и т.д.
- [ ] ProblemDetails middleware (RFC 9457, поле `code`)
- [ ] Пагинация: общий контракт `{items,page,pageSize,totalCount,totalPages}`
- [ ] Optimistic concurrency: маппинг `xmin` → `concurrencyToken` (Base64Url)
- [ ] Audit-инфраструктура: `IAuditLogWriter`, запись в той же транзакции
- [ ] Outbox-инфраструктура: transactional outbox, worker (`FOR UPDATE SKIP LOCKED`), retry/backoff, dead-letter
- [ ] `UserSecurityToken` инфраструктура (SetPassword/ResetPassword)
- [ ] Refresh-сессии: rotation, reuse detection, cookie-топология (`app.<domain>`/`api.<domain>`)
- [ ] `mtf-migrator` bootstrap: Organization + HeadOffice Branch + первый Organization Admin в одной транзакции (`DEPLOY-030`)
- [ ] Composite FK и CHECK-ограничения раздела 12.2/12.2a (минимум для сущностей Phase 1: Organization, Branch, User, Category, CategorySettings)
- [ ] Health checks: `/health/live`, `/health/ready` с классификацией зависимостей
- [ ] Metrics exporter: `/metrics`, включая tenant-метрики раздела 30.4

## Auth

- [ ] `POST /auth/login` — lockout (5 попыток/15 мин), rate limit 10/мин/IP
- [ ] `POST /auth/refresh` — rotation, reuse detection, cookie+CSRF
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me` — форма ответа `AUTH-037`/`AUTH-038`
- [ ] `POST /auth/change-password`
- [ ] `POST /auth/forgot-password` — всегда 202, rate limit 5/час/IP
- [ ] `POST /auth/reset-password`
- [ ] `POST /auth/set-password`
- [ ] `POST /telegram/bind-token`, `GET /telegram/status`, `DELETE /telegram/binding`
- [ ] OpenAPI: обновить/расширить `mentortaskflow-auth.yaml` (уже частично готов)
- [ ] Integration-тесты: rotation, reuse detection, lockout, TokenVersion mismatch
- [ ] Frontend-подключение: заменить MSW auth-handler реальным API (форма не меняется)

## Organizations

- [ ] `GET /organization` — Controller/Service/policy/OpenAPI/тесты
- [ ] `PUT /organization` — Controller/Service/validation/policy/CT/Audit/OpenAPI/тесты
- [ ] Frontend-подключение: `SettingsPage` Organization tab → заменить `updateOrganizationNamePreview`

## Branches

- [ ] `GET /branches` — пагинация + фильтр `isActive` + сортировка
- [ ] `GET /branches/{id}` — разный DTO по роли (`BranchDto` vs `BranchSummaryDto`)
- [ ] `POST /branches` — Controller/Service/validation/policy/Audit/OpenAPI/тесты
- [ ] `PUT /branches/{id}` — CT/Audit/OpenAPI/тесты
- [ ] `POST /branches/{id}/activate`
- [ ] `POST /branches/{id}/deactivate` — `confirmActiveUsers`, приоритет `HEAD_OFFICE_DEACTIVATION_FORBIDDEN`
- [ ] `POST /branches/{id}/make-head-office` — атомарная транзакция снятия/установки флага
- [ ] Composite unique index `ux_branches_single_head_office`, `ux_branches_organization_code`, `ux_branches_organization_normalized_name`
- [ ] Integration-тесты: `TEST-TEN-022`…`TEST-TEN-024`, `TEST-TEN-033`
- [ ] Frontend-подключение: `BranchesPage`, `BranchDetailsDrawer` — заменить `useBranchPreviewActions`
- [ ] Базовый контракт (`name/code/address/timeZoneId`) реализуется без ожидания решения ниже
- [ ] **Открытый вопрос перед добавлением расширенных полей** (не блокирует базовый контракт): `city/contactEmail/contactPhone` — PRODUCT-APPROVED EXTENSION, требует фиксации в ТЗ (см. Phase_1_Product_Extensions_and_Open_Questions.md §1.1); `adminOption/adminUserId` — не отдельный endpoint, реализуется оркестрацией `POST /branches`+`change-role` (см. §1.2)

## Users

- [ ] `GET /users`, `GET /users/{id}` — фильтры по role/adminScope/categoryId/branchId/status
- [ ] `POST /users` — серверное определение scope по правилам `USER-032`
- [ ] `PATCH /users/{id}` — только `fullName` (согласовать судьбу `notificationLanguage`)
- [ ] `POST /users/{id}/activate`, `/deactivate`
- [ ] `POST /users/{id}/change-role` — включая смену `AdminScope`
- [ ] `POST /users/{id}/change-category`
- [ ] `POST /users/{id}/change-branch` — 10-шаговая транзакция `BRN-048`
- [ ] `POST /users/{id}/resend-invitation`
- [ ] Уникальный индекс `ux_users_normalized_email` (глобальный), `ux_users_active_lead_per_category`
- [ ] Composite FK `fk_users_branch_scope`, `fk_users_category_scope`
- [ ] Integration-тесты: `TEST-TEN-025`…`TEST-TEN-029`, `TEST-TEN-034`, `TEST-TEN-037`…`TEST-TEN-039`, `TEST-DB-006`, `TEST-DB-009`, `TEST-DB-010`
- [ ] Frontend-подключение: `UsersPage`, `UserDetailsDrawer` — заменить `useUserPreviewActions`
- [ ] **Открытые вопросы (не блокируют базовый контракт `POST /users`, `activate`/`deactivate`, которые реализуются в определённом ТЗ виде уже сейчас)**: окончательная backend-модель «Block/Unblock» относительно `Deactivate`/`Activate` не финализирована — см. Phase_1_Product_Extensions_and_Open_Questions.md §3.3; «Send password-reset link» для активного пользователя — §3.4. Форма создания пользователя, ограничивающая выбор до `BranchAdmin\|Lead\|Mentor`, — это Frontend UX-решение, **не gap backend-контракта** (`POST /users` уже поддерживает создание Organization Admin, см. §3.0)

## Categories

- [ ] `GET /categories`, `GET /categories/{id}`, `GET /categories/{id}/settings`
- [ ] `POST /categories` — атомарное создание Category + CategorySettings
- [ ] `PUT /categories/{id}`
- [ ] `PUT /categories/{id}/settings` — валидация диапазонов, перерегистрация планировщика
- [ ] `POST /categories/{id}/activate`, `/deactivate` — `confirmActiveUsers`
- [ ] Уникальный индекс `ux_categories_branch_normalized_name`
- [ ] Composite FK `fk_categories_branch_scope`, `fk_category_settings_scope`
- [ ] Integration-тесты: `TEST-TEN-031`, `TEST-TEN-010`, `TEST-SCH-003`
- [ ] Frontend-подключение: `CategoriesPage`, `CategoryDetailsDrawer` — заменить `useCategoryPreviewActions`

## Assignments / Submissions / Reviews (только чтение + force-cancel)

- [ ] `GET /assignments`, `GET /assignments/{id}`, `GET /assignments/{id}/history`
- [ ] `GET /assignments/{id}/submissions`, `GET /submissions/{id}/review`
- [ ] `GET /submissions/{id}/download-url`, `/preview-url` — presigned URL TTL 10 мин, `X-MTF-Branch-Id` обязателен для OA
- [ ] `POST /assignments/{id}/cancel` (force-cancel, `ASN-025`) — domain-метод `Assignment.Cancel(reason, forceCancel:true)`, единственная мутация Admin. **Requirement classification = TZ-MUST, Decision status = CONFIRMED, Backend = REQUIRED** независимо от отсутствия UI-кнопки (Frontend status = UI_MISSING) — реализуется в рамках Phase 1, не откладывается на Phase 3
- [ ] Минимальная domain-модель конечного автомата Assignment (раздел 13), достаточная для корректного `status` в `GET`
- [ ] Composite FK `fk_assignments_assignee_scope`, `fk_submissions_assignment_scope`
- [ ] Integration-тесты: `TEST-ASN-004` (для force-cancel по аналогии с cancel), `TEST-TEN-017`
- [ ] Frontend-подключение: `AssignmentsPage`, `AssignmentDetailsDrawer` (read-only часть)
- [ ] **Открытый вопрос**: добавить ли UI-кнопку force-cancel в рамках Phase 1 или отложить как «backend ready, UI later» (см. Phase_1_Product_Extensions_and_Open_Questions.md)

## Notifications / Outbox

- [ ] `GET /admin/notifications`
- [ ] `GET /admin/notifications/{id}` — функциональность обязательна (payload-модал уже в UI); decision required только по декомпозиции: отдельный endpoint (рекомендуется) vs расширенное поле в элементе списка
- [ ] `POST /admin/notifications/{id}/retry` — только из `DeadLetter`, без потери истории попыток
- [ ] Outbox worker: `FOR UPDATE SKIP LOCKED`, batch, backoff (1м/5м/15м/1ч/6ч), lease timeout 5 мин, dead-letter при `Attempts=5`
- [ ] Дедупликация: `UNIQUE(deduplication_key)`, ключи со scope-префиксом (`TEN-043`)
- [ ] Payload-санитайзер: исключение provider secrets из ответа `GET /admin/notifications/{id}`
- [ ] Integration-тесты: `TEST-OBX-001`…`TEST-OBX-005`, `TEST-CON-005`, `TEST-TEN-018`, `TEST-TEN-019`
- [ ] Frontend-подключение: `NotificationsPage` — заменить `notificationPreviewStore`

## Audit

- [ ] `GET /admin/audit-log` — фильтры actor/action/entityType/entityId/branch/дата/correlationId
- [ ] Запись `audit.read` при каждом просмотре журнала (`AUD-023`)
- [ ] AuditLog writer подключён ко всем мутациям выше (Organizations/Branches/Users/Categories/Notifications/Assignments)
- [ ] Retention job (04:00 UTC): обнуление IP/UserAgent через 90 дней, удаление записи через 3 года
- [ ] Integration-тесты: `TEST-TEN-018`, `TEST-DB-008`
- [ ] Frontend-подключение: `AuditPage` — заменить статичный `PREVIEW_AUDIT_ENTRIES`

## Reports

- [ ] `GET /reports/personal`, `GET /reports/team`, `GET /reports/branches`
- [ ] `POST /reports/ai-summary` — кэш по `CacheKey` со scope, лимит регенерации 1/сутки/субъект, бюджет времени 90с
- [ ] Формулы метрик — точное соответствие разделу 21 (включая `FirstPassApprovalRate` из 21.3, `OverdueRate` из 21.4)
- [ ] Правило ≥5 менторов для обезличенных метрик (`ANA-012`, `TEN-072`)
- [ ] Группировка исключительно по `(BranchId, CategoryId)` (`TEN-071`)
- [ ] Integration-тесты: `TEST-ANA-001`…`TEST-ANA-004`, `TEST-TEN-005`, `TEST-TEN-010`, `TEST-AI-001`…`TEST-AI-003`
- [ ] Frontend-подключение: `ReportsPage` — заменить статичную фикстуру, подключить «Обновить резюме»
- [ ] **Не реализовывать пока**: endpoint экспорта отчёта — функция одобрена продуктом как `PRODUCT-APPROVED EXTENSION` (владелец продукта подтвердил полезность), но контракт (маршрут/формат/синхронность) не спроектирован и раздел 5 ТЗ ещё не обновлён; реализация начинается только после Product Decision и правки ТЗ (см. Phase_1_Product_Extensions_and_Open_Questions.md §1.5)

## Health

- [ ] `GET /health/live`
- [ ] `GET /health/ready` — классификация Critical/Degraded-capable/Optional, коды 200/503
- [ ] `GET /metrics` — только внутренняя сеть
- [ ] Единый источник данных для `/admin/health` и блока `systemHealth` на Dashboard (сегодня две несвязанные фикстуры на Frontend)
- [ ] Frontend-подключение: `HealthPage` — заменить `PREVIEW_SERVICES`/`PREVIEW_SYSTEM_EVENTS`
- [ ] **Открытый вопрос**: источник данных для `IncidentHistoryModal` (см. Phase_1_Product_Extensions_and_Open_Questions.md)

## Settings

- [ ] `PUT /organization` подключение (см. блок Organizations выше)
- [ ] Открытый вопрос по вкладкам Notifications/Integrations: system-level / organization-level / deployment-level (см. Phase_1_Product_Extensions_and_Open_Questions.md §3.1) — до выбора уровня backend для этих двух вкладок не создаётся; это не решено автоматически в пользу «не делать вообще», а остаётся открытым архитектурным вопросом
- [ ] Interface-вкладка (язык/sidebar/тема) — подтвердить, что остаётся client-only (localStorage), backend не создаётся

## Definition of Done (повторяется на каждый endpoint выше)

- [ ] Backend реализован
- [ ] Frontend подключён (если применимо)
- [ ] Все применимые уровни авторизации раздела 9.1
- [ ] Tenant-колонки, composite FK, tenant-ведущий индекс, явный scope-фильтр
- [ ] Валидация запроса и бизнес-инвариантов (в БД, где выразимо)
- [ ] Audit / TaskEvent — если применимо
- [ ] Outbox-уведомление — если применимо (Приложение E)
- [ ] Unit-тесты
- [ ] Integration-тесты (БД/storage/провайдер)
- [ ] Frontend-тесты (если есть интерфейс)
- [ ] Миграция БД (если меняется схема)
- [ ] OpenAPI обновлён
- [ ] Состояния `loading/empty/error/forbidden` (Frontend)
- [ ] Acceptance criteria (Given/When/Then) пройдены
- [ ] Наблюдаемость: структурированные логи с `CorrelationId`, метрика (если фоновая/внешний провайдер)
- [ ] Приложение L обновлено (если добавлены переменные окружения)
- [ ] Security review: нет Critical/High issues, нет секретов в логах
