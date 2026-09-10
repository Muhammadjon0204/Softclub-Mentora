# REAL FRONTEND-BACKEND INTEGRATION AUDIT

**Дата:** 2026-09-08
**Метод:** Phase 0-4 — статический анализ реального кода (Backend controllers + Frontend api/hooks/pages), верифицированный живым `GET /swagger/v1/swagger.json` с работающего backend. Phase 5-9 — **прямые HTTP-вызовы (curl) к реально работающему backend + прямые SQL-запросы к реальному PostgreSQL + проверка Mailhog/MinIO**, а не только чтение кода. Браузерной автоматизации в этой сессии не было (нет Playwright/DevTools-доступа) — это единственное решённое сознательно отступление от брифа, согласованное с пользователем; везде ниже прямо указано, что именно проверено (LIVE API+DB), а что — только код.

Ни один вывод не основан на прежних статус-репортах. Каждый ✅/🔴/⚪/⚠️ ниже подкреплён либо живым запросом (показан request+response), либо конкретной строкой кода.

---

## Summary

| Метрика | Значение |
|---|---:|
| Backend endpoints всего (Swagger + health/metrics) | **79** (77 в Swagger + `/health/live` + `/health/ready`; `/metrics` не JSON API, не считается) |
| Frontend API-клиентов, реально вызывающих backend | **73** endpoint-путей покрыты кодом в `api/*.ts` или прямым `apiClient` в странице |
| ✅ LIVE_INTEGRATED (проверено live API+DB в этой сессии) | **17** endpoints напрямую прогнаны curl'ом с реальными токенами и сверены с БД |
| ✅ CODE_VERIFIED (реальный вызов подтверждён чтением кода, не прогнан live отдельно) | ~56 |
| 🟡 PARTIAL/HYBRID (реальный вызов есть, но часть данных на странице — мок) | **2 домена** (см. ниже) — **оба исправлены в этой сессии** |
| 🔴 NOT_CONNECTED (UI использует мок вместо реального вызова) | **3 места** — **все исправлены в этой сессии** |
| ⚪ BACKEND_ONLY (endpoint реально работает, но НИ ОДИН frontend-код его не вызывает) | **7 endpoints** (Reports ×4, Telegram ×3) |
| ⚠️ MOCKED, но недостижимо из реального роутинга (мёртвый код) | 4 файла |

---

## PHASE 0 — Инфраструктура (LIVE, проверено в этой сессии)

| Компонент | Статус | Доказательство |
|---|---|---|
| Docker Desktop | ✅ работает | `docker --version` → 29.6.1 |
| `docker compose ps` | ✅ 4/4 контейнера Up | `mentortaskflow-api-1` (:5000, 32 мин uptime), `mentortaskflow-postgres-1` (:5433, healthy), `mentortaskflow-minio-1` (:9000-9001, healthy), `mentortaskflow-mailhog-1` (:1025/8025) |
| PostgreSQL | ✅ реальные данные | `\dt` → 20 таблиц реальной схемы; данные см. Phase 8 |
| MinIO | ✅ реально хранит файлы | Presigned URL реально отдал загруженный файл, см. Phase 6 |
| API (`GET /health/live`) | ✅ `200 {"status":"Healthy"}` | curl |
| API (`GET /health/ready`) | ✅ `200`, но `"status":"Degraded"` (postgres Healthy, storage Healthy, **ai Degraded** — реальный факт: AI-провайдер не настроен) | curl |
| `/metrics` (Prometheus) | ✅ 200 | curl |
| Frontend dev server (:5173) | ✅ 200 | curl |
| Frontend → Backend проводка | ✅ `vite.config.ts` проксирует `/api` → `http://localhost:5000`; `.env` отсутствует, но `apiClient` использует относительный baseURL — эквивалентно | код + curl |
| MSW в production runtime | ✅ **отсутствует** | `main.tsx` не импортирует `mocks/browser.ts` нигде — MSW используется только в `src/test/*.test.tsx` (легитимно, тестовая инфраструктура) |

**Вывод Phase 0:** инфраструктура полностью живая, frontend физически не может быть перехвачен MSW в браузере — весь трафик реально уходит в сеть.

---

## PHASE 1 — Backend endpoint inventory (из живого `/swagger/v1/swagger.json`, 77 путей + 2 health)

| Domain | Endpoints | Auth policy (из чтения всех 14 контроллеров) |
|---|---:|---|
| AUTH | 8 (`login`, `refresh`, `logout`, `me`, `change-password`, `forgot-password`, `reset-password`, `set-password`) | AllowAnonymous/Authenticated по месту; **нет self-register endpoint** |
| ORGANIZATION | 2 (`GET`/`PUT /organization`) | Authenticated / OrganizationAdmin |
| BRANCHES | 6 | OrganizationAdmin (кроме `GET /{id}` — Authenticated) |
| USERS | 10 | LeadOrAdmin / AnyAdmin; `change-role` к Admin — только OrganizationAdmin |
| CATEGORIES | 8 | Authenticated (read) / AnyAdmin (write) |
| ASSIGNMENTS | 9 | Authenticated (read) / Lead (lifecycle) / LeadOrAdmin (`cancel`) |
| SUBMISSIONS | 4 | Mentor (upload) / Authenticated (read/urls) |
| REVIEWS | 2 | Lead (create) / Authenticated (read) |
| TOPICS + TOPIC ASSIGNMENTS | 12 | Authenticated (read) / LeadOrAdmin (write) |
| TEAM | 0 (нет отдельного домена — реализуется через `GET /users`) | — |
| ADMIN DASHBOARD | 1 | AnyAdmin |
| REPORTS | 4 | Authenticated/OrganizationAdmin |
| NOTIFICATIONS (admin) | 2 | AnyAdmin |
| AUDIT | 1 | AnyAdmin |
| HEALTH | 2 (`/health/live`, `/health/ready`, вне `/api/v1`, вне Swagger) | AllowAnonymous |
| TELEGRAM | 4 (bind-token, status, binding DELETE, webhook) | Authenticated (3) / AllowAnonymous+secret (webhook) |
| **ИТОГО** | **79** | |

---

## PHASE 2-3 — Endpoint-by-endpoint mapping (главная таблица)

Легенда: ✅LIVE = проверено live curl+DB в этой сессии · ✅CODE = вызов подтверждён чтением кода · 🟡HYBRID · 🔴NOT_CONNECTED · ⚪BACKEND_ONLY

| Backend endpoint | Frontend call | Hook/страница | Статус |
|---|---|---|---|
| `POST /auth/login` | `api/auth.ts` | `AuthProvider`/`LoginPage` | ✅LIVE (login.test.tsx + мой прямой curl, см. Phase 6) |
| `GET /auth/me`, refresh, logout, change/forgot/reset/set-password | `api/auth.ts`, `api/generated/auth-api.ts` | `AuthProvider`, `refreshCoordinator` | ✅LIVE (`/auth/me` прогнан curl) |
| `GET/PUT /organization` | `api/admin/organization.ts` | `SettingsPage.tsx` | ✅LIVE (`GET` прогнан curl → реальная организация) |
| `GET /branches`, `POST`, `PUT`, `activate`, `deactivate`, `make-head-office` | `api/admin/branches.ts` | `BranchesPage.tsx`, `useBranchesQuery`, `useBranchActions` | ✅LIVE (`GET` прогнан → 2 реальных филиала = БД) |
| `GET/POST/PATCH /users`, `activate`, `deactivate`, `change-role`, `change-category`, `change-branch`, `resend-invitation` | `api/admin/users.ts` | `UsersPage.tsx`, `useUsersQuery`, `useUserActions` | ✅LIVE (`GET` прогнан → 5 реальных юзеров = БД; `change-role` реально дважды исполнен в E2E-тесте, см. Phase 6) |
| `GET/POST/PUT /categories`, `activate/deactivate`, `settings` | `api/admin/categories.ts` | `CategoriesPage.tsx` | ✅LIVE (`GET` → 1 реальная категория C# = БД) |
| `GET /assignments`, `{id}`, `history`, `drafts`, `PUT`, `publish`, `accept-suggestion`, `reassign`, `start-review`, `cancel` | `api/lead/assignments.ts` | `useScopedLeadAssignments`, `useScopedMentorAssignments`, Kanban, Lead/Mentor Assignments-страницы | ✅LIVE — **полный E2E цикл прогнан вживую**, см. Phase 6 |
| `POST /assignments/{id}/submissions`, `GET .../submissions`, `download-url`, `preview-url` | `api/lead/submissions.ts` | `useSubmissions.ts`, mentor submission upload | ✅LIVE — реальный PDF залит в MinIO, скачан обратно, байт-в-байт совпадение |
| `POST /submissions/{id}/reviews`, `GET .../review` | `api/lead/reviews.ts` | `useReviewActions.ts`, `ReviewWorkspaceDrawer` | ✅LIVE — реальный Approve прогнан, создал `reviews` row |
| `GET/POST/PUT /topics`, `activate/deactivate`, `DELETE`, `{topicId}/assignments` | `api/lead/topics.ts` | `useScopedLeadTopics`, `useScopedMentorTopics` | ✅CODE (только type-импорт из mocks, сам вызов реальный; live не прогонял отдельно — БД показала `topics: 0` строк, т.е. схема пуста, но код корректен) |
| `PUT/POST/DELETE /topic-assignments/{id}` | `api/lead/topicAssignments.ts` | `useTopicActions`/`useTopicAssignmentActions` | ✅CODE |
| `GET /admin/dashboard` | `api/admin/dashboard.ts` | `useDashboardQuery` → Admin Dashboard, **ReportsPage.tsx (admin)**, **HealthPage.tsx** | ✅LIVE — прогнан curl, `systemHealth` реально дёргает `HealthCheckService` (не заглушка, latency отличался между вызовами) |
| `GET /admin/audit-log` | **инлайн `apiClient` прямо в `AuditPage.tsx`** (нет отдельного `api/*.ts` файла — это НЕ баг, вызов реальный) | `AuditPage.tsx` | ✅LIVE — прогнан curl → 6 реальных audit-строк, совпало с `SELECT count(*) FROM audit_logs` |
| `GET /admin/notifications`, `POST retry` | **инлайн `apiClient` прямо в `NotificationsPage.tsx`** | `NotificationsPage.tsx` | ✅LIVE — прогнан curl → 0 items, совпало с `SELECT count(*) FROM notification_outbox` (было 0 до E2E-теста, стало 3 после) |
| `GET /reports/personal` `/team` `/branches`, `POST /reports/ai-summary` | **НЕТ ни одного вызова нигде во Frontend** | — | ⚪**BACKEND_ONLY** — прогнан curl напрямую, endpoint реально работает (`GET /reports/branches` → 200, валидный ReportDto), но ни одна кнопка в UI на него не ведёт |
| `POST /telegram/bind-token`, `GET /telegram/status`, `DELETE /telegram/binding` | **НЕТ ни одного вызова нигде во Frontend** | — | ⚪**BACKEND_ONLY** — `GET /telegram/status` прогнан curl → реальный 404 (нет привязки), сам механизм жив, UI для привязки Telegram не построен вообще |
| `POST /telegram/webhook` | N/A (бот, не frontend) | — | не применимо |

---

## PHASE 4/6 — Mock-данные: что нашлось и что исправлено

### 🔴→✅ Исправлено в этой сессии (было НАСТОЯЩИМ mock/hybrid, подтверждено чтением кода до правки)

1. **`features/lead-dashboard/useLeadDashboard.ts`, `features/lead-reports/useLeadReports.ts`, `pages/lead/ReportsPage.tsx`** — все три читали `scopedActiveMentors(categoryId)` из `features/lead/scope/leadScopedData.ts`, а тот фильтрует `getMentorDirectorySnapshot()` (мок-стор `leadMentorPreviewStore.ts`, семя — `MENTOR_DIRECTORY` из `leadWorkspace.ts` со строковыми id вида `'cat-hq-csharp'`). Реальный `categoryId` из `GET /auth/me` — настоящий UUID (`01a03cb6-2725-...`). Строковый мок-id **никогда** не равен реальному UUID ⇒ `scopedActiveMentors(realCategoryId)` **всегда возвращает пустой массив**, даже когда у Lead реально есть менторы с реальной активностью.
   - **Проверено живьём**: после того как я реальным Lead-логином создал/провёл через весь цикл задание для реального ментора Мухаммад Косимов (Approved), на `/lead/dashboard` виджет «Команда» и на `/lead/reports` таблица «По менторам» и фильтр «Ментор» **показывали бы пусто**, несмотря на реальную завершённую работу в БД.
   - **Исправление:** переключил все три места на `useActiveLeadMentors()` (`features/lead/scope/useScopedLeadMentors.ts`) — уже существующий, реально работающий хук поверх `GET /users`, ранее использовавшийся только на `/lead/team`. `lastActiveLabel` заменён с фиктивного `formatOffsetHoursAgo(lastActiveOffsetHours)` (у реальных данных это поле всегда `null`) на настоящий `mentor.lastLoginLabel`.
   - Typecheck (`tsc --noEmit`) — чисто. Vitest — 49/49 зелёных, регрессий нет.

2. **`features/admin-branches/BranchForm.tsx` (`BranchCreateForm`)** — селектор администратора при создании филиала читал `useUsersPreview()` (26+ фейковых пользователей из `PREVIEW_USERS`) вместо реального списка.
   - **Исправление:** переключено на `useUsersQuery()`.
   - **Оставшееся ограничение (задокументировано, не полностью устранимо в этой сессии):** даже после выбора реального пользователя, `useBranchActions.createBranch`'s `adminAssignRequested`-путь — осознанная заглушка с тостом «Назначение администратора при создании пока недоступно» (см. код, `useBranchActions.ts`). Полноценное назначение через отдельные "Назначить"/"Сменить администратора" диалоги подключено к `POST /users/{id}/change-role` в этой же сессии ранее (до аудита); подключение "assign-on-create" оставлено на усмотрение пользователя как отдельная задача, т.к. требует пересмотра оркестрации create-then-assign с обработкой частичного отказа.

3. **`features/admin-branches/BranchMetricsSection.tsx`** и **`DeactivateBranchDialog.tsx`** — оба показывали `usersCount`/`categoriesCount`, посчитанные из мок-сторов (`useUsersPreview()`, `PREVIEW_CATEGORIES`), сравнивая по строке `branchName`, а не по реальному `branchId`.
   - **Исправление:** переключены на `useUsersQuery()` (фильтр по реальному `branchId`) и `useCategoriesForBranch(branch.id, isOrgAdmin)` (реальный `GET /categories`). Убрана метрика «Ожидают проверки» (была построена из мок-категорий, реального источника для неё нет — честно опущена, а не заменена на фиктивный 0).

### ⚪ Мёртвый код (не является live-багом — недостижим из реального роутинга, оставлен как есть)

- `features/admin-notifications/notificationPreviewStore.ts` — ни одна страница его не импортирует (реальная `NotificationsPage.tsx` их не использует).
- `features/admin-reports/{MetricDetailsDrawer,ExportReportModal}.tsx` — ни одна страница их не рендерит.
- `features/admin-users/userPresentation.ts#activeCategoriesForBranch` — после более ранней правки этой же сессии (см. ниже) не имеет ни одного вызывающего.

### ✅ Подтверждено, что НЕ мок (проверено по коду и/или live)

- `useScopedLeadAssignments`/`useScopedMentorAssignments`/`useScopedLeadTopics`/`useScopedMentorTopics`/`useScopedLeadMentors`/`useTeamActions` — импортируют ТИПЫ из `mocks/ui-preview/*`, но реальные значения приходят из `listAssignments()`/`listTopics()`/`useUsersQuery()`. Подтверждено live E2E (Phase 6).
- `HealthPage.tsx` (admin) — переиспользует `GET /admin/dashboard`'s `systemHealth`, который реально вызывает `HealthCheckService.CheckHealthAsync` на backend — не заглушка.
- `AuditPage.tsx`, `NotificationsPage.tsx` (admin) — реальные инлайн `apiClient`-вызовы, несмотря на отсутствие отдельного `api/*.ts`-файла.

---

## PHASE 6/9 — Live evidence (реальные запросы этой сессии)

**Login (LIVE):**
```
POST /api/v1/auth/login {"email":"nurulloadmin@gmail.com","password":"123456"}
→ 200, реальный JWT (sub=01a03cb6-277c-..., role=Admin, org_id=реальный)
```

**Users GET verified:**
`GET /api/v1/users` → 200 → **5 реальных пользователей**, totalCount=5, точно совпадает с `SELECT count(*) FROM users` (5). Роли/email совпадают 1:1 со списком из брифа.

**Branches GET verified:**
`GET /api/v1/branches` → 200 → 2 реальных филиала («Филиал Профсоюз» head office + «Филиал Созедания»), совпадает с `SELECT count(*) FROM branches`.

**Categories GET verified:**
`GET /api/v1/categories` → 200 → 1 реальная категория «C#», совпадает с БД.

**Admin Dashboard verified:**
`GET /api/v1/admin/dashboard` → 200 → `systemHealth.services` содержит реальные live health-checks (postgres 23.3ms Operational, storage 25.9ms Operational, ai Degraded «AI-провайдер не настроен») — значения латентности отличались между двумя отдельными вызовами в разное время, что физически невозможно для статической заглушки.

**Audit Log verified:**
`GET /api/v1/admin/audit-log` → 200 → 6 реальных строк, совпадает с `SELECT count(*) FROM audit_logs` (было 6 до E2E-теста, 7 после — включая мой собственный `audit.read` на этот же запрос).

**Reports (backend-only) verified:**
`GET /api/v1/reports/branches` → 200, валидный `ReportDto` (from/to/periodTimeZoneId/isCrossBranchAggregate/rows) — **endpoint работает**, просто ни разу не вызывается из UI.

### Полный Mentor→Lead workflow — LIVE, от начала до конца, через реальный API + реальную БД

1. **Lead** (`alijonzabirov20@mail.ru`) → `POST /assignments/drafts` → `201`, реальная строка в `assignments` (status=Draft).
2. Lead → `POST /assignments/{id}/publish` → `200`, status→Assigned.
3. **Mentor** (`kosimovmuhamadjon23@gmail.com`) → `GET /assignments` → **реально видит** новое задание (totalCount=1).
4. Mentor → `POST /assignments/{id}/submissions` (multipart, `audit_submission.pdf`, 312 байт) → сначала `415 FILE_TYPE_NOT_ALLOWED` на `.txt` (**реальная валидация типов файлов работает**), после подмены на настоящий PDF → `201`, реальный SHA-256, `hasPreview:true`. Assignment.status автоматически → Submitted.
5. Lead → `GET /assignments/{id}/submissions` → видит submission.
6. Lead → `POST /assignments/{id}/start-review` → `200`, status→InReview.
7. Lead → `POST /submissions/{id}/reviews` `{"decision":"Approved"}` → `201`, реальная строка в `reviews`. Assignment.status→Approved.
8. Mentor → `GET /assignments/{id}/history` → видит все 5 событий по порядку (DraftCreated→Assigned→SubmissionUploaded→ReviewStarted→ReviewApproved).

**DB proof (прямой SQL после теста):**
```
assignments: 1, submissions: 1, reviews: 1, task_events: 5, notification_outbox: 3
```

**File proof:** presigned `download-url` реально скачал 312 байт `application/pdf` из MinIO — байт-в-байт то, что было загружено.

**Notification proof:** 3 строки в `notification_outbox` (`status='Sent'`) → реально дошли в Mailhog (`GET http://localhost:8025/api/v2/messages` → `total: 3`, реальные Subject/To на русском для `kosimovmuhamadjon23@gmail.com` и `alijonzabirov20@mail.ru`).

**Вердикт Mentor↔Lead workflow: ✅ РАБОТАЕТ ПОЛНОСТЬЮ, end-to-end, через реальный API/DB/MinIO/SMTP.**

### 🐛 Найден реальный backend-баг при live-тесте (не frontend-проблема, для сведения)

`AssignmentService.cs:690`:
```csharp
private static string ActorLabel(TaskEvent taskEvent) => taskEvent.ActorId is null ? "Система" : "Lead";
```
Для замаскированного актора (Mentor смотрит историю своего задания, `EVT-004`) label **всегда** «Lead», даже для события `SubmissionUploaded`, которое совершил сам Mentor. Живой тест это подтвердил: в `GET /assignments/{id}/history` от лица Mentor все 5 событий, включая его собственную загрузку файла, подписаны как «Lead». Это баг доменной логики backend, не проблема wiring — **не исправлял без запроса**, т.к. это выходит за рамки "подключить существующий frontend к существующим contracts" и требует решения, как правильно маскировать разные роли акторов.

---

## PHASE 8 — Data purity (LIVE)

- `SELECT count(*) FROM users` = 5, `GET /users` totalCount = 5. **Совпадает.**
- `SELECT count(*) FROM branches` = 2, `GET /branches` totalCount = 2. **Совпадает.**
- `SELECT count(*) FROM categories` = 1, `GET /categories` totalCount = 1. **Совпадает.**
- До E2E-теста `assignments`/`submissions`/`reviews`/`notification_outbox` были **пусты** — `GET /assignments` тоже отдавал `totalCount: 0`, UI (после моих правок Lead Dashboard/Reports) корректно показал бы честный empty-state, а не старые demo-данные. Ни один демо-объект из старого preview-набора (`usr-1017`, `cat-hq-csharp`, `mentor-head@mentortaskflow.test` и т.п.) не встретился ни в одном live-ответе backend.

**Вывод: реальные данные организации ("Филиал Профсоюз", "C#", 5 реальных пользователей) — единственное, что видно через реальный API. Старый preview-мир полностью изолирован в `mocks/` и не течёт в production-ответы backend.**

---

## Critical gaps (итог)

| # | Приоритет | Что | Статус |
|---|---|---|---|
| 1 | P1 | Lead Dashboard «Команда» + Lead Reports «По менторам»/фильтр «Ментор» — mock-мостор с несовместимыми id, всегда пусто на реальных данных | ✅ **Исправлено в этой сессии** |
| 2 | P1 | Создание филиала с одновременным назначением админа — mock-список пользователей в форме | ✅ **Список исправлен**; сама привязка admin-on-create остаётся no-op (see выше) |
| 3 | P2 | Вкладка «Показатели» филиала + подтверждение деактивации — фейковые счётчики пользователей/категорий | ✅ **Исправлено в этой сессии** |
| 4 | P1/P2 | Reports-домен (4 backend endpoints) никогда не вызывается frontend; Admin «Отчёты» показывает Dashboard-данные под чужим заголовком; Lead/Mentor «Отчёты» реализуют ту же аналитику клиентским кодом, без backend-защит (ANA-012 анонимизация малых N, ANA-013 self-only) | 🔴 Не исправлено — архитектурное решение, требует отдельного разговора |
| 5 | P2 | Telegram-домен (3 endpoints) полностью без UI — привязать Telegram нельзя нигде в интерфейсе | 🔴 Не исправлено — отсутствующая фича, не баг wiring |
| 6 | P3 | Backend `ActorLabel` всегда «Lead» для замаскированного актора | 🐛 Найдено live-тестом, не исправлено (backend business logic, не wiring) |
| 7 | P3 | Мёртвый код: `notificationPreviewStore.ts`, `MetricDetailsDrawer.tsx`, `ExportReportModal.tsx`, `activeCategoriesForBranch` | Не трогал — недостижим, не влияет на продакшн |

---

## Security / Tenant isolation — что реально проверено

- Presigned MinIO URL реально содержит путь `organizationId/branchId/categoryId/assignmentId/submissionId.ext` — подтверждена multi-tenant изоляция на уровне storage path.
- `415 FILE_TYPE_NOT_ALLOWED` на `.txt` — реальная серверная валидация типов, не полагается на клиент.
- JWT реально содержит `org_id`/`admin_scope`/`role` claims, проверено декодированием живого токена.
- Не проверял живьём cross-tenant/cross-branch 403/404 сценарии (например, Branch Admin другого филиала пытается читать эти данные) — **не входит в объём этого прохода**, отдельная задача при необходимости.

---

## Final Verdict: **PARTIALLY INTEGRATED**

- Ядро продукта (Auth, Users, Branches, Categories, Assignments, Submissions, Reviews, Topics, Team, Admin Dashboard/Health/Audit/Notifications) — **реально живое**, подтверждено live API+DB, включая полный кросс-ролевой workflow Mentor→Lead с файлом в MinIO и письмами в Mailhog.
- Три конкретных источника mock/hybrid данных, ошибочно считавшихся "wired" в прошлых сессиях, найдены и **исправлены** в этой сессии (Lead Dashboard/Reports mentor-виджеты, форма создания филиала, метрики/деактивация филиала).
- Reports-домен и Telegram-домен — backend полностью готов и работает (проверено live), но frontend их не использует вообще. Это не "мок", а честно нулевая интеграция ⚪ — открытый вопрос продукта, не быстрый фикс.
- Найден один реальный backend-баг (ActorLabel) live-тестированием — не в объёме "frontend↔backend wiring", вынесен отдельно.

**НИ ОДИН из этих выводов не является "ALL APIS ARE CONNECTED" или "CODE-COMPLETE" — каждый вывод выше подкреплён конкретным запросом/ответом/DB-строкой/файлом кода.**
