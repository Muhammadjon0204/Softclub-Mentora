# Phase 1 API Endpoint Catalog

Базовый путь подтверждён и Frontend, и ТЗ: **`/api/v1`** (`API-001`; уже используется в `Frontend/src/api/admin/{dashboard,branches,organization}.ts` — `GET /api/v1/admin/dashboard`, `GET /api/v1/branches`, `GET /api/v1/organization`). Заголовок арендного scope — **`X-MTF-Branch-Id`** (`TEN-032`; байт-в-байт совпадает с именем, уже используемым в `Frontend/src/features/branch-context/branchHeaderInterceptor.ts`). Ничего из перечисленного ниже не изобретено — каждый endpoint взят из Приложения D/D.0–D.7 и Приложения N ТЗ, отфильтрован до релевантных Phase 1, и сверен с текущим Frontend/MSW.

## Система классификации (две независимые оси)

Каждый **endpoint, учитываемый в статистике каталога**, помечен ровно одним значением по каждой из двух осей — они не смешиваются в одну ячейку и не комбинируются текстом («TZ-MUST + …» больше не используется):

**Requirement Classification** (обязательность/происхождение требования):
- `TZ-MUST` — прямо требуется ТЗ (Requirement ID существует).
- `PRODUCT-APPROVED EXTENSION` — подтверждено текущим продуктовым UI/владельцем продукта, прямого требования ТЗ нет; требует фиксации в следующей версии ТЗ.
- `FUTURE PHASE` — принадлежит Phase 2/3/4, не строится в Phase 1.
- `OUT OF SCOPE` — не входит и не будет входить в Phase 1 по решению ТЗ.

**Decision Status** (готов ли контракт к реализации без дополнительного решения):
- `CONFIRMED` — контракт (маршрут, DTO, policy) полностью определён ТЗ или уже согласован; можно реализовывать сейчас. Отсутствие кнопки в текущем Frontend **не понижает** этот статус — см. правило ниже.
- `PRODUCT DECISION REQUIRED` — до реализации нужен ответ Product/Architecture (форма DTO не совпадает с UI, семантика не определена, либо решается сама необходимость отдельного endpoint).

**Правило «отсутствие UI ≠ открытый вопрос».** Если контракт endpoint полностью определён ТЗ и единственная причина пометки — отсутствие кнопки/страницы во Frontend, endpoint получает `Decision Status = CONFIRMED` и колонку **Backend** = `REQUIRED` (реализуется независимо от Frontend), а колонку **Frontend integration status** = `UI_MISSING`. Пример — `ASN-025` (раздел 6 ниже) и `BRN-005` (раздел 3).

**Правило подсчёта endpoint.** В таблицах ниже нумеруются только эндпоинты, представляющие **отдельный обязательный или предлагаемый API-контракт**. UI-действия, реализуемые как **оркестрация нескольких уже перечисленных endpoint** (например «назначить администратора при создании филиала» = `POST /branches` + `POST /users/{id}/change-role`), вынесены в отдельный раздел «UI-действия, не являющиеся отдельным endpoint» в конце соответствующего модуля и **не входят** в итоговый подсчёт — иначе один и тот же backend-контракт считался бы дважды. Это отвечает на вопрос §8 задания: для «details/metrics/activity/candidates»-подобных действий явно указано, где это обязательный контракт, а где — рекомендуемый способ декомпозиции UI поверх уже существующих endpoint.

Колонка **Frontend integration status**: `READY_TO_CONNECT` / `FRONTEND_READ_ONLY_READY` / `UI_MISSING` / `PREVIEW_ONLY` / `FUTURE_PHASE` / `CONTRACT_MISMATCH`. Колонка **CT** = требуется `concurrencyToken`; **A** = AuditLog; **E** = TaskEvent; **N** = Outbox-уведомление; **BH** = требование заголовка `X-MTF-Branch-Id` для Organization Admin.

---

## 1. Auth (`/api/v1/auth/*`, `/api/v1/telegram/*`)

Уже частично специфицирован в `Frontend/openapi/mentortaskflow-auth.yaml` и реализован в MSW (`Frontend/src/mocks/handlers/auth.ts`) — эталонная реализация контракта, включая rate limiting, lockout, CSRF, rotation/reuse detection. Frontend-модуль форм **не изменяется** (раздел 41.2 ТЗ).

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `/login` | Вход | TZ-MUST | CONFIRMED | AUTH-001, AUTH-024 | `POST /auth/login` | Анонимно | — | `LoginRequest` → `AuthLoginResponse` | 200 | 401 `INVALID_CREDENTIALS`, 429 | Выдача cookie, `LastLoginAt`, сброс `FailedLoginCount` | A | READY_TO_CONNECT | Форма уже реализована; менять нельзя |
| A2 | interceptor | Обновление токена | TZ-MUST | CONFIRMED | AUTH-007, AUTH-008 | `POST /auth/refresh` | Cookie + CSRF | — | — → `{accessToken}` | 200 | 401 `REFRESH_TOKEN_INVALID`, 401 `REFRESH_TOKEN_REUSE_DETECTED`, 403 `CSRF_VALIDATION_FAILED` | Ротация; при reuse — отзыв family + `TokenVersion++` | A (при reuse) | READY_TO_CONNECT | — |
| A3 | topbar | Выход | TZ-MUST | CONFIRMED | AUTH-009 | `POST /auth/logout` | Cookie + CSRF | — | — | 204 | 403 `CSRF_VALIDATION_FAILED` | Отзыв refresh-токенов | A | READY_TO_CONNECT | — |
| A4 | bootstrap приложения | Профиль | TZ-MUST | CONFIRMED | AUTH-003, AUTH-037 | `GET /auth/me` | Аутентифицирован | Свои Org/Branch | — → `AuthUserDto` | 200 | 401 | — | — | READY_TO_CONNECT | — |
| A5 | `/profile` (не смонтирован) | Смена пароля | TZ-MUST | CONFIRMED | AUTH-014 | `POST /auth/change-password` | Аутентифицирован | Сам | `ChangePasswordRequest` | 200 | 400, 401 | `TokenVersion++`, отзыв прочих сессий | A | UI_MISSING | Backend REQUIRED независимо от статуса `/profile`; компонент `ChangePasswordForm.tsx` уже написан |
| A6 | `/login` → «Забыли пароль» | Запрос сброса | TZ-MUST | CONFIRMED | AUTH-015, AUTH-016 | `POST /auth/forgot-password` | Анонимно | — | `{email}` | 202 | 429 | Outbox(Email) | — | READY_TO_CONNECT | — |
| A7 | `/reset-password` | Установка нового пароля | TZ-MUST | CONFIRMED | AUTH-018 | `POST /auth/reset-password` | Анонимно | — | `{token,newPassword}` | 200 | 400 `SECURITY_TOKEN_INVALID`, 429 | `TokenVersion++`, отзыв токенов | A | READY_TO_CONNECT | — |
| A8 | `/set-password` | Установка первого пароля | TZ-MUST | CONFIRMED | AUTH-020, AUTH-021 | `POST /auth/set-password` | Анонимно | — | `{token,newPassword}` | 200 | 400, 429 | Установка `PasswordHash` | A | READY_TO_CONNECT | — |
| A9 | `/profile` (не смонтирован) | Привязка Telegram | TZ-MUST | CONFIRMED | TG-005, TG-006 | `POST /telegram/bind-token` | Аутентифицирован | Сам | — → `{token,deepLink,expiresAt}` | 201 | 429 | Инвалидация прежнего bind-токена | A | UI_MISSING | Backend REQUIRED независимо от `/profile` |
| A10 | `/profile` (не смонтирован) | Статус привязки | TZ-MUST | CONFIRMED | TG-010 | `GET /telegram/status` | Аутентифицирован | Сам | — → `{isLinked,chatId?}` | 200 | 401 | — | — | UI_MISSING | — |
| A11 | `/profile` (не смонтирован) | Отвязка Telegram | TZ-MUST | CONFIRMED | TG-010 | `DELETE /telegram/binding` | Аутентифицирован | Сам | — | 204 | 401 | `TelegramChatId=null` | A | UI_MISSING | Личная отвязка, не путать с org-level Integrations (раздел 11) |

**Итого Auth: 11 endpoint — 11 TZ-MUST / 11 CONFIRMED.**

---

## 2. Organization (`/api/v1/organization`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O1 | все страницы, `/admin/settings` | Чтение профиля организации | TZ-MUST | CONFIRMED | ORG-003 | `GET /organization` | Любой аутентифицированный | Своя Organization | — → `OrganizationDto`/`OrganizationSummaryDto` | 200 | 401, 403 `ORGANIZATION_INACTIVE` | — | — | READY_TO_CONNECT | Уже частично реально |
| O2 | `/admin/settings` → Organization tab | Изменить название организации | TZ-MUST | CONFIRMED | ORG-004 | `PUT /organization` | Organization Admin | Своя Organization | `{name,concurrencyToken}` → `OrganizationDto` | 200 | 400, 403 `FORBIDDEN`, 409 `CONCURRENCY_CONFLICT` | CT, A | A | PREVIEW_ONLY | `Slug`/`IsActive` не редактируются этим endpoint (`ORG-020`, `ORG-007`) |

**Итого Organization: 2 endpoint — 2 TZ-MUST / 2 CONFIRMED.**

---

## 3. Branches (`/api/v1/branches*`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | `/admin/branches` | Список филиалов | TZ-MUST | CONFIRMED | BRN-006 | `GET /branches` | Organization Admin | Своя Organization | query → `PagedResult<BranchDto>` | 200 | 403 (BA/L/M) | — | — | READY_TO_CONNECT | Сегодня без пагинации — добавить при интеграции |
| B2 | `/admin/branches` | Создать филиал | TZ-MUST | **PRODUCT DECISION REQUIRED** | BRN-001, BRN-042 | `POST /branches` | Organization Admin | Своя Organization | `CreateBranchRequest{name,code,address?,timeZoneId}` → `BranchDto` | 201 | 400, 403, 409 `BRANCH_ALREADY_EXISTS` | A(`branch.create`) | A | CONTRACT_MISMATCH | Базовый контракт (`name/code/address/timeZoneId`) сам по себе `CONFIRMED`; статус `PRODUCT DECISION REQUIRED` относится к **дополнительным** полям формы (`city/email/phone/adminOption`) — см. реестр расширений ниже. Реализовывать базовый контракт можно уже сейчас |
| B3 | `/admin/branches/:id` | Профиль филиала | TZ-MUST | CONFIRMED | BRN-007…009 | `GET /branches/{id}` | OA (любой свой), BA/L/M (только свой) | По объекту | — → `BranchDto`/`BranchSummaryDto` | 200 | 404 | — | — | PREVIEW_ONLY | — |
| B4 | `/admin/branches/:id/settings` | Редактировать филиал | TZ-MUST | CONFIRMED | BRN-002 | `PUT /branches/{id}` | **Только** Organization Admin | Целевой Branch | `{name,code,address?,timeZoneId,concurrencyToken}` → `BranchDto` | 200 | 400, 403, 404, 409 `BRANCH_ALREADY_EXISTS`, 409 `CONCURRENCY_CONFLICT` | CT, A | A | PREVIEW_ONLY | — |
| B5 | `/admin/branches` | Активировать филиал | TZ-MUST | CONFIRMED | BRN-004 | `POST /branches/{id}/activate` | Organization Admin | Целевой Branch | `{concurrencyToken}` → `BranchDto` | 200 | 404, 409 `CONCURRENCY_CONFLICT` | CT, A, N(`BranchActivated`) | A / N | PREVIEW_ONLY | — |
| B6 | `/admin/branches` | Деактивировать филиал | TZ-MUST | CONFIRMED | BRN-003 | `POST /branches/{id}/deactivate` | Organization Admin | Целевой Branch | `{confirmActiveUsers?,concurrencyToken}` → `BranchDto` | 200 | 404, 409 `BRANCH_HAS_ACTIVE_USERS`, 409 `HEAD_OFFICE_DEACTIVATION_FORBIDDEN`, 409 `CONCURRENCY_CONFLICT` | CT, A, N(`BranchDeactivated`) | A / N | PREVIEW_ONLY | — |
| B7 | не найдено в текущем UI | Назначить главный офис | TZ-MUST | **CONFIRMED** | BRN-005 | `POST /branches/{id}/make-head-office` | Organization Admin | Целевой Branch | `{concurrencyToken}` → `BranchDto` | 200 | 404, 409 `HEAD_OFFICE_REQUIRED`, 409 `CONCURRENCY_CONFLICT` | CT, A(2 записи) | A | UI_MISSING | Контракт полностью определён `BRN-005`; отсутствие кнопки — Frontend-задача, backend REQUIRED уже сейчас |

**Итого Branches: 7 endpoint — 7 TZ-MUST / 6 CONFIRMED + 1 PRODUCT DECISION REQUIRED (B2).**

### UI-действия, не являющиеся отдельным endpoint (Branches)

| UI-действие | Реализация | Req. classification | Decision status | Не входит в подсчёт, т.к. |
|---|---|---|---|---|
| «Назначить администратора» при создании филиала (`adminOption/adminUserId`) | `POST /branches` (B2) + `POST /users/{id}/change-role` (U9) — 2 последовательных вызова | TZ-MUST | CONFIRMED | Оркестрация уже перечисленных endpoint, не новый контракт |
| «Сменить администратора филиала» (`previousAdminRoleChoice`) | `POST /users/{id}/change-role` (U9) ×2 (новый + обработка прежнего) | TZ-MUST | CONFIRMED | То же |

---

## 4. Users (`/api/v1/users*`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U1 | `/admin/users` | Список пользователей | TZ-MUST | CONFIRMED | USER-010 | `GET /users` | OA/BA/L | По контуру роли | query → `PagedResult<UserSummaryDto>` | 200 | 403 | — | — | PREVIEW_ONLY | — |
| U2 | `/admin/users/:id` | Карточка пользователя | TZ-MUST | CONFIRMED | USER-010 | `GET /users/{id}` | OA/BA/L | По объекту | — → `UserDetailsDto` | 200 | 404 | — | — | PREVIEW_ONLY | `UserDetailsDrawer` |
| U3 | `/admin/users` | Создать пользователя (включая Organization Admin) | TZ-MUST | **CONFIRMED** | USER-001, USER-031, USER-032 | `POST /users` | OA/BA/L | **BH обязателен** для OA (кроме создания OA) | `CreateUserRequest` → `UserDetailsDto` | 201 | 400 `BRANCH_CONTEXT_REQUIRED`, 400, 403 `FORBIDDEN`, 409 `RESOURCE_ALREADY_EXISTS`, 409 `ACTIVE_LEAD_ALREADY_EXISTS`, 409 `CROSS_SCOPE_REFERENCE` | Выпуск `SetPassword`-токена, N(Email), A | A / N | PREVIEW_ONLY | Контракт полностью покрывает создание Organization Admin (`USER-031`; первый OA создаётся `mtf-migrator` bootstrap, `DEPLOY-030`, последующие — этим endpoint). Текущая UI-форма ограничивает выбор роли до `BranchAdmin\|Lead\|Mentor` — это **Frontend UX-решение**, не backend-gap: endpoint не ограничивается текущей формой и не требует отдельного product decision для реализации |
| U4 | `/admin/users/:id` | Редактировать профиль | TZ-MUST | **PRODUCT DECISION REQUIRED** | USER-008 (`fullName`) | `PATCH /users/{id}` | OA/BA | Branch пользователя | `{fullName?,concurrencyToken}` → `UserDetailsDto` | 200 | 400, 404, 409 `CONCURRENCY_CONFLICT` | CT, A | A | PREVIEW_ONLY | Базовый контракт (`fullName`) — `CONFIRMED`; статус `PRODUCT DECISION REQUIRED` относится к полю `notificationLanguage`, которого нет в модели `User` — см. реестр расширений |
| U5 | `/admin/users/:id` | Активировать | TZ-MUST | CONFIRMED | USER-007 | `POST /users/{id}/activate` | OA/BA | По объекту | `{concurrencyToken}` → `UserDetailsDto` | 200 | 403 `BRANCH_INACTIVE`, 404, 409 `ACTIVE_LEAD_ALREADY_EXISTS` | CT, A | A | PREVIEW_ONLY | UI называет это действие и «Активировать», и «Разблокировать» — см. открытый вопрос Block/Unblock ниже; сам контракт активации не меняется |
| U6 | `/admin/users/:id` | Деактивировать | TZ-MUST | CONFIRMED | USER-004…006, USER-036 | `POST /users/{id}/deactivate` | OA/BA | По объекту | `{concurrencyToken}` → `UserDetailsDto` | 200 | 404, 409 | CT, отзыв токенов, `TokenVersion++`, A, N(условно) | A / N | PREVIEW_ONLY | UI называет это действие и «Деактивировать», и «Заблокировать» — см. открытый вопрос Block/Unblock ниже; сам контракт деактивации не меняется |
| U9 | `/admin/users/:id`, `/admin/branches`, `/admin/categories` | Сменить роль / AdminScope | TZ-MUST | CONFIRMED | USER-008, USER-033 | `POST /users/{id}/change-role` | OA/BA | По контуру | `{newRole,newAdminScope?,newBranchId?,newCategoryId?,reason,concurrencyToken}` → `UserDetailsDto` | 200 | 400, 403 `FORBIDDEN`, 404, 409 `ACTIVE_LEAD_ALREADY_EXISTS` | CT, отзыв токенов, `TokenVersion++`, A | A | PREVIEW_ONLY | Также используется как строительный блок для «назначить/сменить Branch Admin» и «назначить/сменить Lead» (см. реестры оркестрации) |
| U10 | не выделено отдельной кнопкой | Сменить категорию (без смены роли) | TZ-MUST | CONFIRMED | USER-011…015, USER-037 | `POST /users/{id}/change-category` | OA/BA | Branch не меняется | `{newCategoryId,reason,concurrencyToken}` → `UserDetailsDto` | 200 | 403 `CATEGORY_INACTIVE`, 409 `CATEGORY_CHANGE_BLOCKED`, 409 `CROSS_SCOPE_REFERENCE` | CT, `UserCategoryHistory`, отзыв токенов, `TokenVersion++`, A | A | UI_MISSING | Контракт полностью определён ТЗ; backend REQUIRED независимо от того, что сегодня функциональность доступна пользователю только внутри диалога «Change role» |
| U11 | `/admin/users/:id` | Перевести в другой филиал | TZ-MUST | CONFIRMED | BRN-036…039 | `POST /users/{id}/change-branch` | **Только** Organization Admin | Старый→новый Branch | `{newBranchId,newCategoryId?,reason,concurrencyToken}` → `UserDetailsDto` | 200 | 400, 403 `BRANCH_INACTIVE`, 403 `CATEGORY_INACTIVE`, 404, 409 `BRANCH_CHANGE_BLOCKED`, 409 `CROSS_SCOPE_REFERENCE`, 409 `CONCURRENCY_CONFLICT` | CT, `UserBranchHistory`(+`UserCategoryHistory`), `TokenVersion++`, отзыв токенов, инвалидация `UserSecurityToken`, A, N(`UserBranchChanged`) | A / N | PREVIEW_ONLY | 10-шаговая транзакция `BRN-048` |
| U12 | `/admin/users/:id` | Повторить приглашение (SetPassword) | TZ-MUST | CONFIRMED | USER-009 | `POST /users/{id}/resend-invitation` | OA/BA/L(свои Mentor) | По объекту | — | 202 | 404, 409 | Инвалидация старого `SetPassword`-токена, новый токен, N(Email), A | A / N | PREVIEW_ONLY | Только для пользователя без установленного пароля (`AUTH-022`) |

**Итого Users: 10 endpoint — 10 TZ-MUST / 9 CONFIRMED + 1 PRODUCT DECISION REQUIRED (U4).**

### UI-действия, не являющиеся отдельным endpoint / открытые вопросы (Users)

| UI-действие | Реализация / статус | Req. classification | Decision status | Комментарий |
|---|---|---|---|---|
| «Заблокировать» (Block, с `reasonCategory`) | Кандидат на переиспользование U6 (`deactivate`) | PRODUCT-APPROVED EXTENSION | **PRODUCT DECISION REQUIRED** | Модель ТЗ не определяет ручную блокировку отдельно от `Deactivate` (`USER-004`) и автоматического `LockoutUntil` (`AUTH-024`). Не утверждается, что Block = Deactivate — это открытый вопрос, см. Phase_1_Product_Extensions_and_Open_Questions.md §3.5 |
| «Разблокировать» (Unblock) | Кандидат на переиспользование U5 (`activate`) | PRODUCT-APPROVED EXTENSION | **PRODUCT DECISION REQUIRED** | То же |
| «Отправить ссылку сброса пароля» активному пользователю | Кандидат на расширение U12 (`resend-invitation`) выпуском `Purpose=ResetPassword` либо новый маршрут | PRODUCT-APPROVED EXTENSION | **PRODUCT DECISION REQUIRED** | ТЗ описывает `resend-invitation` только для пользователя без установленного пароля; для активного пользователя отдельный сценарий не определён |

---

## 5. Categories (`/api/v1/categories*`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | `/admin/categories` | Список категорий | TZ-MUST | CONFIRMED | CAT-006, CAT-007 | `GET /categories` | OA/BA/L/M | По контуру | query → `PagedResult<CategorySummaryDto>` | 200 | 403 | — | — | PREVIEW_ONLY | — |
| C2 | `/admin/categories/:id` | Детали категории | TZ-MUST | CONFIRMED | CAT-006 | `GET /categories/{id}` | OA/BA/L/M | По объекту | — → `CategoryDetailsDto` | 200 | 404 | — | — | PREVIEW_ONLY | `CategoryDetailsDrawer` |
| C3 | `/admin/categories` | Создать категорию | TZ-MUST | CONFIRMED | CAT-001, CAT-023 | `POST /categories` | OA(**BH обязателен**)/BA | Целевой Branch | `CreateCategoryRequest`+`CreateCategorySettingsRequest` → `CategoryDetailsDto` | 201 | 400 `BRANCH_CONTEXT_REQUIRED`, 403 `BRANCH_INACTIVE`, 409 `RESOURCE_ALREADY_EXISTS` | Category+CategorySettings в одной транзакции, A | A | PREVIEW_ONLY | Форма верно объединяет оба объекта за один сабмит (`CAT-014`) |
| C4 | `/admin/categories/:id/settings` | Редактировать категорию | TZ-MUST | CONFIRMED | CAT-001 | `PUT /categories/{id}` | OA/BA | По объекту | `{name,description?,concurrencyToken}` → `CategoryDetailsDto` | 200 | 403 `BRANCH_INACTIVE`, 404, 409 `CONCURRENCY_CONFLICT` | CT, A | A | PREVIEW_ONLY | `description` — поле модели `Category` по ТЗ (10.2), не расширение |
| C5 | `/admin/categories/:id/settings` | Редактировать CategorySettings | TZ-MUST | CONFIRMED | CAT-004, CAT-005 | `PUT /categories/{id}/settings` | OA/BA | По объекту | `{timeZoneId,defaultDueTimeLocal,defaultAssignmentDueDays,deadlineReminderHours,allowLateSubmission,concurrencyToken}` → `CategorySettingsDto` | 200 | 400 `VALIDATION_FAILED`, 403 `BRANCH_INACTIVE`, 409 `CONCURRENCY_CONFLICT` | CT, A, перерегистрация задач планировщика | A | PREVIEW_ONLY | — |
| C6 | `/admin/categories` | Активировать | TZ-MUST | CONFIRMED | CAT-002 | `POST /categories/{id}/activate` | OA/BA | По объекту | `{concurrencyToken}` → `CategoryDetailsDto` | 200 | 403 `BRANCH_INACTIVE`, 404 | CT, A | A | PREVIEW_ONLY | — |
| C7 | `/admin/categories` | Деактивировать | TZ-MUST | CONFIRMED | CAT-002, CAT-003 | `POST /categories/{id}/deactivate` | OA/BA | По объекту | `{confirmActiveUsers?,concurrencyToken}` → `CategoryDetailsDto` | 200 | 404, 409 `CATEGORY_HAS_ACTIVE_USERS` | CT, A | A | PREVIEW_ONLY | — |

**Итого Categories: 7 endpoint — 7 TZ-MUST / 7 CONFIRMED.**

### UI-действия, не являющиеся отдельным endpoint (Categories)

| UI-действие | Реализация | Req. classification | Decision status | Не входит в подсчёт, т.к. |
|---|---|---|---|---|
| «Назначить / сменить Lead» (`PreviousLeadFate`) | `POST /users/{id}/change-role` (U9), Role=Lead, CategoryId=целевая | TZ-MUST | CONFIRMED | Оркестрация Users-endpoint, не Category-контракт |
| «Кандидаты на роль Lead» (список Mentor категории) | `GET /users` (U1) с фильтром `branchId`+`role=Mentor` | PRODUCT-APPROVED EXTENSION | PRODUCT DECISION REQUIRED | UX-удобство (серверный фильтр `eligibleForLead`), не обязателен: диалог может работать на обычном списке пользователей |

---

## 6. Assignments / Submissions / Reviews — только чтение + force-cancel

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AS1 | `/admin/assignments` | Список задач | TZ-MUST | CONFIRMED | ASN-009 | `GET /assignments` | OA/BA/L/M | По контуру | query → `PagedResult<AssignmentSummaryDto>` | 200 | 403 | — | — | PREVIEW_ONLY | — |
| AS2 | `/admin/assignments` | Детали задачи | TZ-MUST | CONFIRMED | ASN-009 | `GET /assignments/{id}` | OA/BA/L/M | По объекту | — → `AssignmentDetailsDto` | 200 | 404 | — | — | PREVIEW_ONLY | `AssignmentDetailsDrawer` |
| AS3 | Assignments (History tab) | История событий | TZ-MUST | CONFIRMED | ASN-009, EVT-004 | `GET /assignments/{id}/history` | OA/BA/L/M | По объекту | — → `TaskEventDto[]` | 200 | 404 | — | — | PREVIEW_ONLY | — |
| AS4 | Assignments (Submissions tab) | Список версий работы | TZ-MUST | CONFIRMED | SUB-005 | `GET /assignments/{id}/submissions` | OA/BA/L/M | По объекту | — → `SubmissionSummaryDto[]` | 200 | 404 | — | — | PREVIEW_ONLY | — |
| AS5 | `FileDetailsModal`/`FilePreviewModal` | Скачать файл | TZ-MUST | CONFIRMED | SUB-006, TEN-065 | `GET /submissions/{id}/download-url` | OA(**BH обязателен**)/BA/L/M | По объекту | — → `{url,expiresAt}` | 200 | 400 `BRANCH_CONTEXT_REQUIRED`, 404, 503 `STORAGE_UNAVAILABLE` | `Cache-Control: no-store` | — | PREVIEW_ONLY | — |
| AS6 | `FilePreviewModal` | Просмотр PDF | TZ-MUST | CONFIRMED | SUB-006 | `GET /submissions/{id}/preview-url` | OA(**BH обязателен**)/BA/L/M | По объекту | — → `{url,expiresAt}` | 200 | 400 `BRANCH_CONTEXT_REQUIRED`, 404 | `Cache-Control: no-store` | — | PREVIEW_ONLY | — |
| AS7 | Assignments (Review tab) | Решение проверки | TZ-MUST | CONFIRMED | REV-002 | `GET /submissions/{id}/review` | OA/BA/L/M | По объекту | — → `ReviewDto` | 200 | 404 | — | — | PREVIEW_ONLY | — |
| AS8 | **отсутствует в UI** | Force-cancel задачи | **TZ-MUST** | **CONFIRMED** | ASN-006, ASN-025, BRN-033 | `POST /assignments/{id}/cancel` | OA(**BH обязателен**)/BA (force) | По объекту | `{cancelReason,force:true,concurrencyToken}` → `AssignmentDetailsDto` | 200 | 400, 400 `BRANCH_CONTEXT_REQUIRED`, 409 `ASSIGNMENT_TERMINAL` | CT, E(`Cancelled`), N(если публиковался), A(`assignment.force_cancel`) | A / E / N | **UI_MISSING** | Единственная мутация Assignment, доступная Admin. **Frontend status = UI_MISSING; Backend = REQUIRED** — контракт полностью определён ТЗ и обязателен к реализации в Phase 1 независимо от отсутствия кнопки в `AssignmentsPage` |
| — | — | Все прочие переходы (`publish`,`accept-suggestion`,`reassign`,`start-review`,`POST /submissions/{id}/reviews`,`POST .../submissions`) | FUTURE PHASE | — | ASN-001…005, REV-001…008, SUB-001…004 | — | Lead / Mentor | — | — | — | — | — | — | FUTURE_PHASE | Phase 3 (Lead) / Phase 4 (Mentor); **не входят в подсчёт Phase 1** |

**Итого Assignments/Submissions/Reviews (Phase 1): 8 endpoint — 8 TZ-MUST / 8 CONFIRMED.** (Future-phase переходы перечислены для контекста и не включены в счёт.)

---

## 7. Notifications (`/api/v1/admin/notifications*`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| N1 | `/admin/notifications` | Список Outbox | TZ-MUST | CONFIRMED | NTF-014, TEN-046 | `GET /admin/notifications` | OA/BA | По контуру | query → `PagedResult<NotificationOutboxDto>` | 200 | 403 | — | — | PREVIEW_ONLY | — |
| N2 | `/admin/notifications/:id` | Детали + payload | TZ-MUST | **PRODUCT DECISION REQUIRED** | NTF-014 | `GET /admin/notifications/{id}` | OA/BA | По объекту | — → `NotificationOutboxDetailsDto` | 200 | 404 | — | — | PREVIEW_ONLY | Функциональность обязательна (`NotificationPayloadModal` уже есть в UI), но отдельный `GET .../{id}` не выделен явно в Приложении D ТЗ — decision нужен только по **декомпозиции** (отдельный endpoint vs расширенное поле в элементе списка N1), не по необходимости самой функции |
| N3 | `/admin/notifications` | Повторить доставку | TZ-MUST | CONFIRMED | NTF-014, TEN-047 | `POST /admin/notifications/{id}/retry` | OA/BA | По объекту | `{}` → `NotificationOutboxDto` | 200 | 404, 409 (не `DeadLetter`) | Сброс `Attempts=0`, статус→`Pending`, A | A | PREVIEW_ONLY | История прошлых попыток не стирается |

**Итого Notifications: 3 endpoint — 3 TZ-MUST / 2 CONFIRMED + 1 PRODUCT DECISION REQUIRED (N2).**

---

## 8. Audit (`/api/v1/admin/audit-log`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AU1 | `/admin/audit` | Журнал аудита | TZ-MUST | CONFIRMED | AUD-002, AUD-023, TEN-040 | `GET /admin/audit-log` | OA/BA | По контуру | query → `PagedResult<AuditLogEntryDto>` | 200 | 403 | — | A(`audit.read`) | PREVIEW_ONLY | Сам факт чтения фиксируется отдельной записью |

**Итого Audit: 1 endpoint — 1 TZ-MUST / 1 CONFIRMED.**

---

## 9. Reports (`/api/v1/reports*`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | drill-down из `/admin/reports` | Личные метрики | TZ-MUST | CONFIRMED | ANA-011, TEN-070 | `GET /reports/personal` | OA/BA/L/M | По контуру | query → `PersonalReportDto` | 200 | 403 | — | — | PREVIEW_ONLY | — |
| R2 | `/admin/reports` | Командные метрики | TZ-MUST | CONFIRMED | ANA-012, ANA-013, TEN-070…074 | `GET /reports/team` | OA/BA/L/M | По контуру | query → `TeamReportDto` | 200 | 403 `INSUFFICIENT_SAMPLE_SIZE`, 404 | — | — | PREVIEW_ONLY | Формулы исключительно по разделу 21 ТЗ |
| R3 | не найдено явно в UI | Сравнение филиалов | TZ-MUST | CONFIRMED | TEN-070, TEN-073 | `GET /reports/branches` | **Только** Organization Admin | Все Branch Organization | query → `BranchComparisonReportDto[]` | 200 | 403 `FORBIDDEN`, 403 `INSUFFICIENT_SAMPLE_SIZE` | — | — | UI_MISSING | Контракт полностью определён ТЗ; backend REQUIRED независимо от отсутствия визуального блока |
| R4 | `/admin/reports` | AI-резюме | TZ-MUST | CONFIRMED | AI-009…013 | `POST /reports/ai-summary` | OA/BA/L/M | Выбранный Branch (не «Все филиалы») | `{scope,subjectId?,periodFrom,periodTo,forceRegenerate?}` → `AiSummaryDto` | 200/201 | 404, 429 `AI_REGENERATION_LIMIT`, 503 `AI_PROVIDER_UNAVAILABLE` | Запись `AiSummary`, A | A | PREVIEW_ONLY | Кнопка сегодня — toast-заглушка |
| R5 | `/admin/reports` → «Экспортировать» | Экспорт отчёта | **PRODUCT-APPROVED EXTENSION** | **PRODUCT DECISION REQUIRED** | — | Предлагается: `POST /reports/export` (формат/маршрут не определены) | OA/BA/L/M (по аналогии с R2) | Как R2 | `ExportReportRequest{format,sections[]}` → файл/ссылка (формат ответа не определён) | — | — | — | — | PREVIEW_ONLY | Владелец продукта подтвердил полезность функции в текущем UI; ТЗ (раздел 5) сегодня относит экспорт к «вне Release 1.0» — **требуется формальное обновление ТЗ**, прежде чем контракт может получить статус `CONFIRMED`. До этого backend endpoint не реализуется |

**Итого Reports: 5 endpoint — 4 TZ-MUST + 1 PRODUCT-APPROVED EXTENSION (R5) / 4 CONFIRMED + 1 PRODUCT DECISION REQUIRED (R5).**

---

## 10. Health (`/health/*`, `/metrics`)

| # | UI page | UI action | Req. classification | Decision status | Req ID | Method & Route | Permission | Tenant scope | Request/Response DTO | Success | Error codes | TX / side-effects | Audit / Outbox | FE status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H1 | инфраструктура | Liveness | TZ-MUST | CONFIRMED | OBS-003 | `GET /health/live` | Анонимно | — | — | 200 | — | — | — | N/A | Не вызывается из UI |
| H2 | `/admin/health` | Готовность и статус зависимостей | TZ-MUST | CONFIRMED | OBS-004…006 | `GET /health/ready` | Анонимно (код) / Admin (тело) | — | — → `{status,dependencies[]}` | 200/503 | — | — | — | PREVIEW_ONLY | Frontend сегодня использует **две разные** несвязанные фикстуры (Health-страница и Dashboard) — backend отдаёт один источник правды для обеих |
| H3 | инфраструктура | Метрики | TZ-MUST | CONFIRMED | OBS-007 | `GET /metrics` | Внутренняя сеть | — | — | 200 | 403 | — | — | N/A | Не вызывается из UI |

**Итого Health: 3 endpoint — 3 TZ-MUST / 3 CONFIRMED.**

### UI-действия, не являющиеся отдельным endpoint (Health)

| UI-действие | Реализация | Req. classification | Decision status | Не входит в подсчёт, т.к. |
|---|---|---|---|---|
| `IncidentHistoryModal` (история инцидентов) | Предлагается: `GET /admin/audit-log` (AU1) с фильтром `action IN (OrganizationSystemAlert, NotificationDeadLetter, ...)` | PRODUCT-APPROVED EXTENSION | PRODUCT DECISION REQUIRED | ТЗ не определяет отдельную сущность «Incident»; переиспользование AuditLog — рекомендация, не обязательный отдельный endpoint |

---

## 11. Settings (`/admin/settings`) — сводка по вкладкам

| Вкладка | Endpoint(ы) | Req. classification | Decision status |
|---|---|---|---|
| Organization → название | `PUT /organization` (O2) | TZ-MUST | CONFIRMED |
| Organization → Slug / Главный офис (read-only) | `GET /organization`, `GET /branches` | TZ-MUST | CONFIRMED |
| Security (read-only) | Нет endpoint — значения из Приложения L ТЗ (env vars) | — | — (endpoint не требуется) |
| Notifications (Email/Telegram/reminder toggles) | Endpoint не определён | — | **PRODUCT DECISION REQUIRED** — открытый вопрос об уровне (см. §3.2 Phase_1_Product_Extensions_and_Open_Questions.md): system-level (deploy-конфигурация, `Features:*`), organization-level (новая сущность) или deployment-level (вне Admin UI вообще). Решение **не принимается автоматически** в пользу «не реализовывать» — фиксируется как открытый вопрос |
| Integrations → Disconnect Email/Telegram (org-level) | Endpoint не определён | — | **PRODUCT DECISION REQUIRED** — тот же открытый вопрос об уровне, что и выше |
| Integrations → MinIO/AI provider (информационно) | `GET /health/ready` (переиспользование H2) | TZ-MUST | CONFIRMED |
| Interface (язык, sidebar, тема) | Нет — клиентские настройки, localStorage | OUT OF SCOPE | CONFIRMED (решение принято: остаётся client-only) |

Эти строки **не входят** в подсчёт endpoint ниже — по определению «Notifications»/«Integrations» вкладок пока нет утверждённого контракта (не TZ-MUST и не подтверждённое расширение, а открытый вопрос уровня архитектуры).

---

## Итоговая статистика каталога (Phase 1)

| Модуль | Endpoint в подсчёте | TZ-MUST | PRODUCT-APPROVED EXTENSION | FUTURE PHASE | OUT OF SCOPE | CONFIRMED | PRODUCT DECISION REQUIRED |
|---|---|---|---|---|---|---|---|
| Auth | 11 | 11 | 0 | 0 | 0 | 11 | 0 |
| Organization | 2 | 2 | 0 | 0 | 0 | 2 | 0 |
| Branches | 7 | 7 | 0 | 0 | 0 | 6 | 1 |
| Users | 10 | 10 | 0 | 0 | 0 | 9 | 1 |
| Categories | 7 | 7 | 0 | 0 | 0 | 7 | 0 |
| Assignments/Submissions/Reviews | 8 | 8 | 0 | 0 | 0 | 8 | 0 |
| Notifications | 3 | 3 | 0 | 0 | 0 | 2 | 1 |
| Audit | 1 | 1 | 0 | 0 | 0 | 1 | 0 |
| Reports | 5 | 4 | 1 | 0 | 0 | 4 | 1 |
| Health | 3 | 3 | 0 | 0 | 0 | 3 | 0 |
| **Итого** | **57** | **56** | **1** | **0** | **0** | **53** | **4** |

Проверка: `56 + 1 + 0 + 0 = 57` (по Requirement Classification) и `53 + 4 = 57` (по Decision Status) — числа совпадают математически, как того требует ревью.

**4 записи с `PRODUCT DECISION REQUIRED`**: B2 (доп. поля Branch), U4 (`notificationLanguage`), N2 (декомпозиция notification-деталей), R5 (экспорт отчётов — контракт).

**Отдельно от счёта 57** (не endpoints, а UI-оркестрация или явные открытые архитектурные вопросы, перечислены в реестрах внутри разделов 3, 4, 5, 10, 11 выше): назначение/смена Branch Admin (оркестрация), назначение/смена Lead (оркестрация), кандидаты на Lead, Block/Unblock (2 позиции), admin-triggered password reset для активного пользователя, история инцидентов, Settings→Notifications/Integrations вкладки (2 позиции). Итого 9 дополнительных пунктов, каждый с собственной пометкой `Req. classification`/`Decision status` в соответствующем разделе — не смешиваются со статистикой основного каталога, чтобы не завышать число «настоящих» endpoint.

**Endpoints будущих фаз** (`FUTURE PHASE`, не входят в счёт 57): создание/публикация/переназначение/старт ревью/решение ревью Assignment, загрузка Submission — Phase 3/4, перечислены в разделе 6.

---

## Каталог ошибок, релевантных Phase 1

Полный список — Приложение C ТЗ (54 кода). Ниже — подмножество, реально возвращаемое endpoint-ами этого каталога; коды **не изобретены**, взяты как есть из ТЗ:

```
VALIDATION_FAILED (400)              UNAUTHORIZED (401)            INVALID_CREDENTIALS (401)
TOKEN_EXPIRED (401)                  TOKEN_VERSION_MISMATCH (401)  REFRESH_TOKEN_INVALID (401)
REFRESH_TOKEN_REUSE_DETECTED (401)   USER_DEACTIVATED (401)        SECURITY_TOKEN_INVALID (400)
BRANCH_CONTEXT_REQUIRED (400)        FORBIDDEN (403)                CSRF_VALIDATION_FAILED (403)
ORGANIZATION_INACTIVE (403)          BRANCH_INACTIVE (403)          SCOPE_OVERRIDE_FORBIDDEN (403)
CATEGORY_INACTIVE (403)              INSUFFICIENT_SAMPLE_SIZE (403) RESOURCE_NOT_FOUND (404)
CONCURRENCY_CONFLICT (409)           CROSS_SCOPE_REFERENCE (409)    BRANCH_ALREADY_EXISTS (409)
BRANCH_HAS_ACTIVE_USERS (409)        HEAD_OFFICE_REQUIRED (409)     HEAD_OFFICE_DEACTIVATION_FORBIDDEN (409)
BRANCH_CHANGE_BLOCKED (409)          ACTIVE_LEAD_ALREADY_EXISTS (409) CATEGORY_CHANGE_BLOCKED (409)
CATEGORY_HAS_ACTIVE_USERS (409)      RESOURCE_ALREADY_EXISTS (409)  ASSIGNMENT_TERMINAL (409)
ASSIGNMENT_INVALID_STATUS_TRANSITION (409)                          RATE_LIMIT_EXCEEDED (429)
AI_REGENERATION_LIMIT (429)          INTERNAL_ERROR (500)           AI_PROVIDER_UNAVAILABLE (503)
STORAGE_UNAVAILABLE (503)
```

Коды `FOREIGN_BRANCH`, `BRANCH_NOT_FOUND`, `ORGANIZATION_NOT_FOUND` и аналоги **отсутствуют и не должны быть введены** ни одним endpoint (`TEN-006`, Приложение C).

Все коды в списке выше **подтверждены**, а не `PROPOSED` — они существуют в нормативном Приложении C ТЗ и совпадают с уже объявленным во Frontend `AdminErrorCode` (`Frontend/src/mocks/handlers/shared.ts:14-29`). Открытые вопросы этого пакета относятся не к кодам ошибок, а к самим endpoint/полям, перечисленным в разделе «Итоговая статистика» выше.
