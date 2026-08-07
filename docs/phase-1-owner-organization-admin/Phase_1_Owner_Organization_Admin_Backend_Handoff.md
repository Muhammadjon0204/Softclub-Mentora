# Phase 1 — Owner / Organization Admin Backend Handoff

> Все ссылки вида `[XXX-000]` указывают на Requirement ID [ТЗ v2.2](../MentorTaskFlow_TZ_v2.2.md). Ссылки вида «раздел N» — на разделы того же документа. Полная развёртка endpoint — [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md). Полное соответствие Requirement ID ↔ UI ↔ endpoint — [Phase_1_TZ_Traceability_Matrix.md](./Phase_1_TZ_Traceability_Matrix.md).

## 1. Назначение фазы

Backend Phase 1 обязан реализовать всё необходимое для подключения существующей Admin-панели (`/admin/*`) к реальному API вместо текущих preview-заглушек. По итогам исследования Frontend (см. `git log`, `Frontend/src/routes/AppRouter.tsx:66-69`) подтверждено: сегодня **только страница `/admin/dashboard`** обращается к реальному типизированному клиенту и MSW-эндпоинту; все остальные разделы (`Branches`, `Users`, `Categories`, `Assignments`, `Notifications`, `Audit`, `Reports`, `Health`, `Settings`) — визуальные UI-прототипы на локальных `preview`-хранилищах (`useSyncExternalStore`), не связанные ни с одним контрактом API. Это прямо документировано комментарием в коде роутера. Задача Phase 1 backend — заменить preview-хранилища реальными вызовами без изменения состава экранов и (в большинстве случаев) без изменения форм.

## 2. Официальные роли и терминология

- Официальная роль этого пакета — **Organization Admin** (`Role='Admin'`, `AdminScope='Organization'`, раздел 8.1 ТЗ). Роль **не называется** `SuperAdmin`, `Owner`, `HeadOfficeAdmin` ни в одном Backend-артефакте (`TEN-011`, ADR-001 §2.7, §4.9). В UI отображается как «Администратор организации» / «Owner» — это только вывеска, не тип роли.
- Второй административный контур — **Branch Admin** (`Role='Admin'`, `AdminScope='Branch'`, раздел 8.2). Работает в том же разделе `/admin/*` (FE-030), с более узким scope. Backend реализует оба контура одной моделью авторизации (`AdminScope`), а не двумя ролями.
- `Lead` и `Mentor` — роли будущих фаз (Phase 3, Phase 4); в Phase 1 они присутствуют только как объекты управления (Admin создаёт/деактивирует/переводит Lead и Mentor), не как действующие пользователи панели.
- Единственная бизнес-граница верхнего уровня — иерархия `Organization → Branch → Category` (раздел 38, ADR-001).

## 3. Источники истины

1. [ТЗ v2.2](../MentorTaskFlow_TZ_v2.2.md) — нормативный источник; при конфликте с Frontend побеждает ТЗ.
2. [ADR-001](../ADR-001-organization-branch-isolation.md) — обоснование модели Organization/Branch/AdminScope.
3. Frontend `Frontend/src/pages/admin/*` + `Frontend/src/features/admin-*` — утверждённая владельцем продуктовая работа; источник UI-полей, действий и workflow.
4. `Frontend/src/mocks/handlers/{auth,branches,dashboard,organization,shared}.ts` — единственные MSW-обработчики, реально соответствующие будущему production-контракту; они уже реализуют scope-модель `X-MTF-Branch-Id`, ProblemDetails, rate limiting и lockout по правилам ТЗ.
5. `Frontend/openapi/mentortaskflow-auth.yaml` — единственная опубликованная часть OpenAPI (только Auth-домен).

## 4. Границы Phase 1

**Входит:** всё, что перечислено в разделе 5 задачи (управление Organization, Branch, User, Category, просмотр Assignment/Submission/Review/уведомлений/аудита/отчётов, force-cancel Assignment).

**Не входит** (см. классификацию `FUTURE PHASE` в [Phase_1_TZ_Traceability_Matrix.md](./Phase_1_TZ_Traceability_Matrix.md)):
- создание/публикация/переназначение/старт ревью/решение ревью Assignment;
- загрузка Submission;
- расписание Topic/TopicAssignment (создание и редактирование — прерогатива Lead; Admin эти endpoints не вызывает, хотя backend-модуль расписания создаётся, так как Category без CategorySettings не существует).

**Явно подтверждённое исключение из «Admin только читает Assignment»:** force-cancel (`ASN-025`, `POST /assignments/{id}/cancel` с `force=true` для Admin) — это единственная мутация Assignment, доступная Organization Admin. UI для неё в текущем Frontend отсутствует (`AssignmentsPage.tsx` — read-only, комментарий в коде подтверждает: "Admin здесь только наблюдает"), но backend endpoint обязателен, а требование не может считаться отменённым только из-за отсутствия кнопки — см. [Phase_1_Product_Extensions_and_Open_Questions.md](./Phase_1_Product_Extensions_and_Open_Questions.md).

## 5. Список экранов Frontend

Страница объединяет несколько endpoint с разными классификациями — колонка ниже указывает преобладающую (endpoint-level классификация — только в [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md)).

| Маршрут | Реальный API сегодня? | Преобладающая классификация endpoint страницы |
|---|---|---|
| `/admin/dashboard` | Да (`GET /api/v1/admin/dashboard`) | TZ-MUST (сам агрегатный endpoint — PRODUCT-APPROVED EXTENSION по декомпозиции, см. открытый вопрос §1.4 в extensions doc) |
| `/admin/branches` | Частично (список филиалов для селектора) | TZ-MUST (1 из 7 endpoint — `PRODUCT DECISION REQUIRED` по доп. полям, см. каталог B2) |
| `/admin/users` | Нет (preview) | TZ-MUST (1 из 10 endpoint — `PRODUCT DECISION REQUIRED` по `notificationLanguage`, см. каталог U4) |
| `/admin/categories` | Нет (preview) | TZ-MUST |
| `/admin/assignments` | Нет (preview, read-only) | TZ-MUST (только чтение + force-cancel) |
| `/admin/notifications` | Нет (preview) | TZ-MUST (1 из 3 endpoint — `PRODUCT DECISION REQUIRED` по декомпозиции деталей, см. каталог N2) |
| `/admin/audit` | Нет (preview) | TZ-MUST |
| `/admin/reports` | Нет (preview) | TZ-MUST (4 из 5 endpoint); экспорт — `PRODUCT-APPROVED EXTENSION`/`PRODUCT DECISION REQUIRED` (см. каталог R5); AI-резюме — TZ-MUST |
| `/admin/health` | Нет (preview, отдельная фикстура от dashboard) | TZ-MUST |
| `/admin/settings` | Нет (preview) | TZ-MUST (вкладка Organization); вкладки Notifications/Integrations — endpoint не определён, открытый вопрос уровня (system/organization/deployment), не «противоречие» — см. открытые вопросы |
| `/profile` | Не реализован во Frontend | TZ-MUST (`UI_MISSING`, `Backend = REQUIRED`) |

Deep-link «страницы» реализованы как query-параметры (`?branchId=`, `?userId=`, `?categoryId=`, `?assignmentId=`, `?notificationId=`, `?service=`, `?metric=`), открывающие Drawer поверх списочной страницы, а не отдельные маршруты `:id`. Backend не обязан ничего проектировать под URL-схему — это чисто Frontend-механизм; важны только сами GET-by-id endpoints.

## 6. Backend module map

| Модуль | Нужен в Phase 1? | Комментарий |
|---|---|---|
| Auth | Да | Полностью: login/refresh/logout/me/change-password/forgot/reset/set-password. Уже частично специфицирован в `openapi/mentortaskflow-auth.yaml` и реализован в MSW. Telegram bind/status/unbind для собственного профиля — да (`/profile`), хотя страницы ещё нет. |
| Organizations | Да | `GET/PUT /organization`. |
| Branches | Да | Полный CRUD без DELETE + activate/deactivate/make-head-office. |
| Users | Да | Создание, редактирование, роль/contour, категория, филиал, инвайты, деактивация/блокировка. |
| Roles / Authorization | Да | `AdminScope`, шесть уровней изоляции (раздел 9.1), policy-матрица. |
| Categories | Да | CRUD + CategorySettings + Lead assignment. |
| Assignments | Частично | Только `GET` (список/деталь/история) + force-cancel. Domain-модель конечного автомата (раздел 13) должна существовать, чтобы `GET` отдавал корректный `status`, но mutating-операции жизненного цикла — Phase 3. |
| Submissions | Частично | Только `GET` списка/детали + download-url/preview-url (для чтения работ Admin'ом при разборе инцидентов). Upload — Phase 4. |
| Reviews | Частично | Только `GET /submissions/{id}/review` (чтение решения). Создание — Phase 3. |
| Files | Да | MinIO-инфраструктура, presigned URL, шаблон ключа (`SUB-009`) — нужна уже в Phase 1, так как Admin читает файлы. |
| Notifications | Да | `GET /admin/notifications`, retry. Полная доставка (Outbox worker, Email/Telegram) нужна как инфраструктура, иначе Notifications-страница будет пустой. |
| Outbox | Да | Тот же модуль, что Notifications; см. раздел 14. |
| Audit | Да | `GET /admin/audit-log`, запись AuditLog из всех мутаций Phase 1. |
| Reports | Да | `GET /reports/personal`, `/reports/team`, `/reports/branches`, `POST /reports/ai-summary`. |
| Health | Да | `/health/live`, `/health/ready`, `/metrics`. |
| Integrations | Частично | Email/Telegram — статус подключения нужен для Health и Settings; управление подключением (disconnect) — см. открытый вопрос (`ORG-024` конфликт). |
| Scheduler | Инфраструктурно | Полноценная авто-генерация — Phase 3/7, но Hangfire-хост, здоровье планировщика (`Health`) и заготовка задач (retention, orphan cleanup) нужны уже в Phase 1 по Definition of Done (раздел 35 ТЗ, п.2). |
| Security Tokens | Да | `UserSecurityToken` (SetPassword/ResetPassword) для инвайтов и сброса пароля. |
| Sessions | Да | `RefreshToken`, `TokenVersion`, инвалидация при смене scope/роли (раздел 16.7). |

## 7. Multi-tenancy architecture

Иерархия: `Organization → Branch → Category` (раздел 38, ADR-001 §2.1–2.2). Полная нормативная модель — не переизлагается здесь; ключевые правила для Backend-реализации Phase 1:

- **Scope берётся из authenticated user context** (`ICurrentUserContext`), никогда из тела/query/заголовка запроса, кроме одного исключения ниже (`ORG-021`, `SEC-003`, ADR-001 §2.8).
- **`OrganizationId` нельзя принимать от клиента** — ни в каком endpoint Phase 1. То же для `BranchId`, `CategoryId`, `Role`, `AdminScope`, `ActorId` (`API-006`).
- **Выбор Branch для Organization Admin** выполняется заголовком **`X-MTF-Branch-Id`** — это подтверждённое, уже используемое в текущем Frontend имя заголовка (`Frontend/src/features/branch-context/branchHeaderInterceptor.ts:4`, точно совпадает с `TEN-032` ТЗ). **Новый заголовок изобретать не нужно.**
  - обязателен для branch-scoped мутаций Organization Admin (иначе 400 `BRANCH_CONTEXT_REQUIRED`, `TEN-033`);
  - опционален для агрегирующих `GET` (его отсутствие = режим «Все филиалы» для списков, где это разрешено, `TEN-036`);
  - запрещён для Branch Admin/Lead/Mentor (403 `SCOPE_OVERRIDE_FORBIDDEN` при передаче, `TEN-032`, уже реализовано в `Frontend/src/mocks/handlers/shared.ts:110-181` как эталон поведения);
  - значение обязано принадлежать Organization пользователя; чужой Branch → 404, не 403 (`TEN-007`).
- **Валидация заголовка** выполняется на каждый запрос (не кэшируется), включая проверку активности Branch.
- **Предотвращение доступа к чужой Organization**: Global Query Filter по `OrganizationId` + явная scope-проверка в каждом handler'е (уровень 5 недостаточен без явной проверки, `SEC-002`, `SEC-030`) + composite FK на уровне PostgreSQL (раздел 12.2a, ADR-001 §2.5) как физический, а не только логический барьер.
- **Фильтрация Branch/Category/User/Assignment**: шесть уровней изоляции в строгом порядке (раздел 9.1) — Organization → Branch → Category → Ownership → Role/AdminScope → Resource-state.
- **404 вместо раскрытия существования**: чужая Organization, чужой Branch, чужая Category, чужой объект и несуществующий объект дают **побайтово идентичный** 404 `RESOURCE_NOT_FOUND` (`TEN-006`, раздел 9.2). Коды `FOREIGN_BRANCH`/`BRANCH_NOT_FOUND` и аналоги **не существуют и не могут быть добавлены**.
- **403 допустим**, когда объект виден, но действие не разрешено ролью/контуром/состоянием арендной единицы (раздел 9.3): `FORBIDDEN`, `SCOPE_OVERRIDE_FORBIDDEN`, `ORGANIZATION_INACTIVE`, `BRANCH_INACTIVE`, `CATEGORY_INACTIVE` (приоритет сверху вниз, `TEN-008`).
- **Режим «Все филиалы»**: `isAllBranches=true` при отсутствии заголовка у Organization Admin для разрешённых списков (`GET /users`, `/categories`, `/topics`, `/assignments`, `/reports/*`, `/admin/notifications`, `/admin/audit-log`). **Мутации в этом режиме запрещены всегда** (`TEN-034`) → 400 `BRANCH_CONTEXT_REQUIRED`. Реализация этого правила уже в текущем MSW-обработчике `requireSingleBranch()` (`Frontend/src/mocks/handlers/shared.ts`) — Backend обязан воспроизвести тот же контракт.

## 8. Authentication и session security

Полностью нормативно описано в разделе 16 ТЗ; Frontend Auth-модуль уже реализован и **не подлежит изменению** (раздел 41.2 ТЗ — форма входа, forgot/reset/set password, change password, refresh cookie, rotation, reuse detection, CSRF, `refreshCoordinator`, `authEvents`, `RoleHomeRedirect` сохраняются как есть). Задача Backend Phase 1 — реализовать контракт, под который этот модуль уже написан:

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/set-password` — контракт уже частично описан в `Frontend/openapi/mentortaskflow-auth.yaml` (8 операций, только Auth-домен) и полностью нормативен в разделе 16 и Приложении D.1 ТЗ.
- Ответ login/`/auth/me` обязан иметь форму `AUTH-037`/`AUTH-038` (раздел 16.9): `id, fullName, email, role, adminScope, organization:{id,name}, branch:{id,name,code,isHeadOffice}|null, categoryId`. Frontend-тип `AuthUser` (`Frontend/src/api/generated/auth-api.ts:188-248`) **уже** реализован именно в этой форме — значит контракт login-ответа зафиксирован и менять его нельзя.
- `TokenVersion`, refresh rotation, reuse detection, инвалидация при смене scope/роли/`AdminScope`/филиала/категории (`AUTH-026`…`AUTH-035`, раздел 16.7) — обязательны, так как каждая мутация Users в Phase 1 (смена роли, филиала, категории, деактивация) должна их вызывать.
- Приглашение (invitation) и сброс пароля — `UserSecurityToken(Purpose=SetPassword|ResetPassword)`, раздел 16.5, 16.4. Backend не генерирует и не показывает пароли (`AUTH-019`).
- Telegram-привязка для собственного профиля (`/telegram/bind-token`, `/telegram/status`, `DELETE /telegram/binding`) относится к `/profile`, которого пока нет во Frontend, но endpoints входят в Phase 1 как `TZ-MUST`/`UI_MISSING`.

## 9. Authorization policies

Матрица по разделу 8 и Приложению A ТЗ. Backend Phase 1 обязан реализовать поведение всех четырёх типов пользователей (так как User CRUD создаёт Lead/Mentor и назначает Branch Admin), но действующим актором панели `/admin/*` являются только оба Admin.

| Действие (сокращённо) | Mentor | Lead | Branch Admin | Organization Admin |
|---|---|---|---|---|
| CRUD Branch | — | — | — | Да |
| CRUD Category | — | — | Свой Branch | Любой Branch своей Organization |
| Создать Branch Admin / Organization Admin | — | — | — | Да |
| Создать Lead/Mentor | — | Своя категория | Свой Branch | Любой Branch |
| Изменить роль / `AdminScope` | — | — | Свой Branch (не Admin) | Своя Organization |
| Перевести пользователя между Branch | — | — | — | Да (`change-branch`, только OA) |
| Force-cancel Assignment | — | — | Свой Branch | Своя Organization |
| Retry уведомлений | — | — | Свой Branch | Своя Organization |
| AuditLog | — | — | Свой Branch (без Organization-level) | Своя Organization (включая Organization-level) |
| Аналитика / сравнение филиалов | Личная | Команда | Свой Branch | Своя Organization + сравнение |

Полная матрица без сокращений — раздел 8.6 и Приложение A ТЗ (нормативны; таблица здесь — выжимка для Phase 1).

## 10. Transaction boundaries

Для каждой операции — атомарная транзакция БД, следующая шагам ТЗ (номер шага = порядок выполнения):

| Операция | Обязательные шаги в одной транзакции | Req ID |
|---|---|---|
| Create User + Invitation + Audit + Outbox | INSERT User → INSERT UserSecurityToken(SetPassword) → INSERT NotificationOutbox(invitation) → INSERT AuditLog | `USER-001`, `USER-032`, `USER-035` |
| Change Role (+ AdminScope) + Session Revocation + Audit | UPDATE User.Role/AdminScope → `TokenVersion++` → REVOKE все RefreshToken → INSERT AuditLog | `USER-008`, `USER-033`, `TEN-015` |
| Change Category | UPDATE User.CategoryId → INSERT UserCategoryHistory → `TokenVersion++` → REVOKE RefreshToken → INSERT AuditLog | `USER-015` |
| Transfer User (change-branch) | `SELECT...FOR UPDATE` User → INSERT UserBranchHistory → INSERT UserCategoryHistory (если меняется) → UPDATE User.BranchId/CategoryId → `TokenVersion++` → REVOKE RefreshToken → инвалидация активных `UserSecurityToken` → INSERT AuditLog → INSERT NotificationOutbox(`UserBranchChanged`) | `BRN-048` (полная последовательность из 10 шагов, раздел 39.6) |
| Assign Branch Admin | Создание User(Role=Admin, AdminScope=Branch) через общий User-flow ИЛИ `change-role` существующего пользователя — см. открытый вопрос про UI-комбинацию «создать филиал + назначить админа» | `USER-031` |
| Change Branch Admin | `change-role` прежнего администратора (Lead/Mentor/деактивация — по выбору в UI) + создание/назначение нового Admin — две последовательные операции, не единая транзакция ТЗ; см. Phase_1_Product_Extensions_and_Open_Questions.md | UI-orchestration |
| Block/Unblock User | Открытый вопрос, модель **не финализирована**: ТЗ не определяет «Block» как отдельное состояние отдельно от `Deactivate`/`IsActive` и автоматического `LockoutUntil` (`AUTH-024`). До Product Decision реализуются только `Activate`/`Deactivate` в определённом ТЗ виде; отдельный `UserStatus`/`BlockAsync` не создаётся ни в одном направлении | `USER-004`, `USER-007`, открытый вопрос — см. Phase_1_Product_Extensions_and_Open_Questions.md §3.3 |
| Deactivate User | UPDATE IsActive=false → REVOKE RefreshToken(`Deactivated`) → `TokenVersion++` → инвалидация активных `UserSecurityToken` → INSERT AuditLog → (условно) INSERT NotificationOutbox(`CategoryWithoutLead`/`BranchWithoutAdmin`) | `USER-004`…`USER-006`, `USER-036` |
| Create Branch | INSERT Branch(IsHeadOffice=false) → INSERT AuditLog(`branch.create`, `BranchId=null`) | `BRN-042` |
| Deactivate Branch | Проверка `confirmActiveUsers` → UPDATE Branch.IsActive=false → INSERT AuditLog → INSERT NotificationOutbox(`BranchDeactivated`, для всех активных пользователей филиала) | `BRN-030`, `BRN-045` |
| Make Head Office | `SELECT...FOR UPDATE` Organization → UPDATE старый Branch.IsHeadOffice=false → UPDATE новый Branch.IsHeadOffice=true → INSERT AuditLog(две метки: previous/new) | `BRN-035` |
| Create Category | INSERT Category → INSERT CategorySettings(TimeZoneId=Branch.TimeZoneId) → INSERT AuditLog | `CAT-001`, `CAT-026` |
| Assign/Change Lead | UPDATE User.Role='Lead' на новом Lead (через `change-role`, с проверкой `ACTIVE_LEAD_ALREADY_EXISTS`) + обработка прежнего Lead (Mentor/Transfer/Deactivate — по выбору в UI) — последовательные операции | `USER-003`, `USER-008` |
| Deactivate Category | Проверка `confirmActiveUsers` → UPDATE Category.IsActive=false → INSERT AuditLog | `CAT-002`, `CAT-003` |
| Retry Notification | UPDATE NotificationOutbox.Status='Pending', Attempts=0 → INSERT AuditLog | `NTF-014` |
| Force-cancel Assignment | Domain-метод `Assignment.Cancel(reason, forceCancel=true)` → INSERT TaskEvent(`Cancelled`) → INSERT NotificationOutbox (если был опубликован) → INSERT AuditLog | `ASN-006`, `ASN-025` |

## 11. Validation rules

- Строгая десериализация: неизвестные поля в теле запроса → 400 `VALIDATION_FAILED` (`API-005`), включая вложенные объекты.
- `OrganizationId`, `BranchId`, `CategoryId`, `Role`, `AdminScope`, `ActorId` и производные — запрещены в теле запроса (`API-006`, `SEC-003`).
- Пагинация: `page ≥ 1` (default 1), `pageSize` 1–100 (default 20); нарушение → 400 (`API-011`).
- Сортировка — только по полям из явного whitelist каждого endpoint; вне whitelist → 400 (`API-004`).
- `cancelReason` / `reason` в change-role, change-category, change-branch, деактивации — 5–500 символов (`ASN-006`, `USER-008`, `USER-011`, `BRN-037`).
- `timeZoneId` — валидация по базе IANA tzdata на сервере (`BRN-010`, `CAT-004`).
- `Branch.Code` — `^[A-Z0-9][A-Z0-9-]*$`, 2–32 символа; `Category.Name` — 3–50 символов; `Organization.Name` — 2–200 символов.

## 12. Concurrency

- Concurrency token — системная колонка PostgreSQL `xmin`, передаётся клиенту как opaque Base64Url-строка `concurrencyToken` (`DEPLOY-006`, `API-020`, раздел 11.6).
- Сущности Phase 1 с concurrency token: `Organization`, `Branch`, `User`, `Category`, `CategorySettings`. (`Assignment` — только для force-cancel.)
- Отсутствие `concurrencyToken` в теле мутирующего запроса, где он обязателен → 400 `VALIDATION_FAILED`.
- Несовпадение → 409 `CONCURRENCY_CONFLICT`, ответ содержит актуальный `concurrencyToken` объекта (чтобы UI мог перезагрузить без второго запроса).
- **Silent overwrite запрещён.** Frontend уже содержит компонент `ConcurrencyConflictDialog` (`Frontend/src/features/system-dialogs/ConcurrencyConflictDialog.tsx`) как готовую заготовку под этот сценарий — сейчас нигде не подключён, подключается вместе с реальными мутациями Phase 1 (`FE-011`).

## 13. Audit events

Полный перечень — раздел 15 [Phase_1_Owner_Organization_Admin_Backend_Handoff.md] не дублируется; см. таблицу в [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md) (колонка Audit event) и раздел 28 настоящего документа не создаётся отдельно — минимальный список Phase 1:

```
organization.update
branch.create, branch.update, branch.activate, branch.deactivate, branch.make_head_office
user.create, user.update, user.change_role, user.change_category, user.change_branch,
user.activate, user.deactivate, user.resend_invitation, user.reset_password_requested
category.create, category.update, category.activate, category.deactivate
notification.retry
audit.read
security.cross_scope_rejected
security.scope_override_rejected
storage.cross_scope_inconsistency
```

Названия соответствуют фактическим значениям `AuditLog.Action`, перечисленным в ТЗ (`TEN-048`, раздел 27.6, раздел 39). Действие `user.change_admin_scope` — та же операция, что `user.change_role` (`USER-033`), не отдельная запись.

## 14. Outbox events

Полный каталог с ключами дедупликации — Приложение E ТЗ. Для Phase 1 актуальны все 19 событий версии 2.2 (Организация/Branch/User порождают события, специфичные Phase 1: `BranchDeactivated`, `BranchActivated`, `UserBranchChanged`, `SchedulerNoActiveMentor`, `CategoryWithoutLead`, `BranchWithoutAdmin`, `OrganizationSystemAlert`, `NotificationDeadLetter`). Outbox для событий жизненного цикла Assignment (`AssignmentAssigned` и т.д.) не порождается действиями Phase 1 UI (кроме force-cancel → `AssignmentCancelled`), но инфраструктура Outbox/worker должна существовать целиком, иначе `/admin/notifications` будет всегда пустой.

## 15. Error contract

RFC 9457 ProblemDetails со стабильным полем `code` (`API-021`). Полный каталог из 54 кодов — Приложение C ТЗ; не переносится сюда целиком, см. [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md) (раздел «Каталог ошибок»). MSW-обработчик `Frontend/src/mocks/handlers/shared.ts:14-29` уже содержит enum `AdminErrorCode`, включающий `BRANCH_ALREADY_EXISTS`, `BRANCH_HAS_ACTIVE_USERS`, `HEAD_OFFICE_DEACTIVATION_FORBIDDEN`, `CATEGORY_HAS_ACTIVE_USERS`, `ACTIVE_LEAD_ALREADY_EXISTS`, `CROSS_SCOPE_REFERENCE`, `CONCURRENCY_CONFLICT`, `BRANCH_CONTEXT_REQUIRED`, `SCOPE_OVERRIDE_FORBIDDEN` — все они **точно совпадают** с кодами ТЗ (полное совпадение, не расхождение): Frontend уже спроектирован под правильный контракт ошибок, backend обязан вернуть именно эти коды, а не альтернативные формулировки.

## 16. Pagination / filtering / sorting

Единый контракт списочного ответа (`API-011`, раздел 23.3):

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 0,
  "totalPages": 0
}
```

`totalCount` вычисляется тем же фильтром, что и `items`, и не раскрывает данные вне scope (`API-012`, `TEN-002`). Fabricated обёртка `Result<T>` не вводится — проект её не использует.

## 17. Files и signed URLs

Phase 1 нужен только для чтения (Admin просматривает Submission при разборе инцидентов через `AssignmentDetailsDrawer` / `FilePreviewModal`, `FileDetailsModal` — уже есть в UI как preview): `GET /submissions/{id}/download-url`, `GET /submissions/{id}/preview-url`. Правила — раздел 17.8, `TEN-064`…`TEN-066`: presigned URL TTL 10 минут, `Cache-Control: no-store`, повторная проверка уровней 1–5 при каждой выдаче, `X-MTF-Branch-Id` обязателен (режим «Все филиалы» → 400 `BRANCH_CONTEXT_REQUIRED`, так как выдача файла — операция конкретного филиала). Шаблон ключа объекта — `submissions/{organizationId}/{branchId}/{categoryId}/{assignmentId}/{submissionId}{extension}` (`SUB-009`).

## 18. Reports и metric calculations

Формулы — исключительно по разделу 21 ТЗ, ничего не придумывается: `TotalAssignments`, `ApprovedAssignments`, `FirstPassApprovalRate` (раздел 21.3), `OverdueRate` (раздел 21.4, считать уникальные Assignment, не события), `InitialSubmissionTime`, `FirstReviewResponseTime`, `FinalReviewTime`, `TotalCycleTime`, `AverageVersions`, `LateSubmissionRate`. При знаменателе 0 → `null`, не 0 и не ошибка (`ANA-004`). Группировка **всегда** по `(BranchId, CategoryId)`, никогда по `Category.Name` (`TEN-071`) — критично, так как одноимённые категории разных филиалов не должны смешиваться. `distinct assignments` — везде `COUNT(DISTINCT a.id)`, не `COUNT(события)`.

**Экспорт отчётов — `PRODUCT-APPROVED EXTENSION`, `Decision status = PRODUCT DECISION REQUIRED`.** Владелец продукта подтвердил полезность функции в текущем утверждённом UI (кнопка «Экспортировать» + модал выбора формата на `/admin/reports`). Раздел 5 действующей редакции ТЗ («Экспорт отчётов в PDF/Excel») сегодня относит эту функцию к «вне Release 1.0» — это не квалифицируется как ошибка Frontend, а фиксируется как требующая обновления следующей версии ТЗ. Backend endpoint **не реализуется** в Phase 1 до (a) проектирования контракта (маршрут/формат/синхронность) и (b) формальной правки раздела 5 ТЗ. См. [Phase_1_Product_Extensions_and_Open_Questions.md](./Phase_1_Product_Extensions_and_Open_Questions.md) §1.5.

AI-резюме (кнопка «Обновить резюме» на `/admin/reports`) **есть** в ТЗ (`AI-009`…`AI-013`, `POST /reports/ai-summary`, лимит принудительной регенерации — 1/сутки/субъект). Это `TZ-MUST`, не расширение; текущая заглушка (toast «AI-провайдер не подключён в preview-режиме») подключается к реальному endpoint.

## 19. Health и integrations

`/health/live`, `/health/ready` (раздел 30.1), `/metrics` (внутренняя сеть). Зависимости и их классы (`Critical`/`Degraded-capable`/`Optional`) — таблица `OBS-004`. Текущая страница `/admin/health` использует **отдельную несвязанную фикстуру** от dashboard (`Frontend/src/mocks/domain/health.ts` для dashboard vs `PREVIEW_SERVICES` для `/admin/health`, с ручной нормализацией `postgres↔db`) — Backend должен отдавать единый источник правды (`GET /health/ready`), обе точки Frontend обязаны читать один и тот же endpoint; текущее раздвоение — Frontend-дефект, а не два разных контракта (не задача Backend исправлять Frontend, но важно не проектировать два разных API под них).

`IncidentHistoryModal` на `/admin/health` не имеет endpoint-аналога в ТЗ — рекомендация: реализовать выборкой Organization-level системных алертов из AuditLog/Outbox (`OrganizationSystemAlert`, `NotificationDeadLetter`), не заводить отдельную таблицу инцидентов — см. открытые вопросы.

## 20. Recommended implementation order

Соответствует фазам 0–1 ТЗ (раздел 33) плюс минимально необходимый срез фаз 2–5 для read-only:

1. Foundation + Tenancy foundation (`ICurrentUserContext`, `IBranchContext`, `X-MTF-Branch-Id`, Global Query Filters, composite FK) — без этого ни один endpoint Phase 1 не может быть корректным.
2. Identity & Authorization (Auth целиком, `TokenVersion`, `AdminScope`, bootstrap).
3. Organization + Branch CRUD.
4. Users CRUD + смена роли/категории/филиала + инвайты.
5. Categories + CategorySettings.
6. Минимальный срез Assignment/Submission/Review domain-модели, достаточный для `GET`-эндпоинтов и force-cancel (без publish/submit/review workflow).
7. Notifications/Outbox инфраструктура + retry.
8. Audit log.
9. Reports (метрики + AI-резюме).
10. Health/metrics.
11. Settings (только подтверждённая часть — `PUT /organization`; остальное — по итогам Product Decision).

Полный чеклист с чекбоксами — [Phase_1_Backend_Implementation_Checklist.md](./Phase_1_Backend_Implementation_Checklist.md).

## 21. Definition of Done

Применяется раздел 35 ТЗ целиком, без исключений, к каждому endpoint Phase 1: backend, frontend (если применимо), все уровни авторизации раздела 9.1, tenant-колонки/FK/индекс для tenant-scoped сущностей, валидация, аудит, уведомления (если применимо Приложением E), unit/integration/frontend-тесты, миграция БД, OpenAPI, состояния `loading/empty/error/forbidden`, acceptance criteria, наблюдаемость, обновление Приложения L (если добавлены переменные окружения), security review.

## 22. Future phases

- **Phase 2 — Branch Admin**: тот же UI, тот же Backend Phase 1, отдельного объёма работ не требует за пределами уже заложенного `AdminScope='Branch'`.
- **Phase 3 — Lead**: жизненный цикл Assignment (создание/публикация/переназначение/отмена без force), Review, расписание Topic/TopicAssignment, авто-генерация (Scheduler/BDA).
- **Phase 4 — Mentor**: загрузка Submission, личный кабинет, личная аналитика.

Все три фазы used переиспользуют мультиарендность, авторизацию, Audit/Outbox, Files, Health, Reports-инфраструктуру Phase 1 без изменений контракта нижнего уровня.
