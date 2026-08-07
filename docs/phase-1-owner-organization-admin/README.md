# Phase 1 — Owner / Organization Admin: пакет Backend Handoff

## Что такое Phase 1

Phase 1 — это готовая на сегодня Admin-панель владельца компании. В пользовательском обиходе роль называется «Owner» (владелец компании), но официальная роль, зафиксированная в [ТЗ v2.2](../MentorTaskFlow_TZ_v2.2.md) (раздел 8.1) и в [ADR-001](../ADR-001-organization-branch-isolation.md), — **Organization Admin** (`Role='Admin'`, `AdminScope='Organization'`). В интерфейсе роль отображается как «Администратор организации».

Отдельная роль `SuperAdmin`/`Owner` **не существует** и не вводится этим пакетом документации: ТЗ прямо запрещает создание новых значений `Role` или `AdminScope` сверх уже определённых (`TEN-011`, раздел 8, ADR-001 §2.7, §4.9). Наименование `SuperAdmin`, встречающееся в истории коммитов Frontend (`fc77942 Finish MVP SuperAdmin UI`), является внутренним рабочим названием UI-прототипа и не должно попадать в Backend-контракт, OpenAPI-спецификацию или доменную модель.

Задача пакета — дать Backend-команде документацию, по которой можно реализовать Backend Phase 1 и подключить к нему уже существующую панель Organization Admin **без повторного анализа всего Frontend**.

## Для какой роли создана панель

**Organization Admin** — администратор, управляющий всей Organization (компанией) в пределах Release 1.0: филиалами (Branch), пользователями и категориями (Category) любого филиала, сводной аналитикой, аудитом и уведомлениями организации. Полное определение прав — раздел 8.1 ТЗ и [Phase_1_TZ_Traceability_Matrix.md](./Phase_1_TZ_Traceability_Matrix.md).

Часть экранов раздела `/admin/*` также используется ролью **Branch Admin** (`AdminScope='Branch'`) — тем же React SPA, той же кодовой базой, но с более узким контуром видимости (свой Branch вместо всей Organization, раздел 8.2 ТЗ, FE-030/ADR-001 §2.9). Backend Phase 1 обязан реализовать оба контура, потому что policy, scope-проверки и UI являются общими и не могут быть разделены без нарушения FE-030/ADR-001. Тем не менее **предметом Phase 1 как продуктовой фазы** остаётся именно Organization Admin: Branch Admin получает те же endpoints «бесплатно» как побочный эффект корректной scope-модели, а не как отдельная задача.

## Какие экраны входят

Раздел `/admin/*` единого React SPA (полный перечень маршрутов — раздел 5 [Backend Handoff](./Phase_1_Owner_Organization_Admin_Backend_Handoff.md)):

| Маршрут | Назначение |
|---|---|
| `/admin/dashboard` | Сводка по системе |
| `/admin/branches` | Филиалы (только Organization Admin) |
| `/admin/users` | Пользователи |
| `/admin/categories` | Категории |
| `/admin/assignments` | Задачи — **только просмотр** |
| `/admin/notifications` | Outbox-уведомления |
| `/admin/audit` | Журнал AuditLog |
| `/admin/reports` | Аналитика |
| `/admin/health` | Состояние системы |
| `/admin/settings` | Настройки организации |

Маршрут `/profile` (смена пароля, привязка Telegram) предусмотрен ТЗ (раздел 24.3), но в текущем Frontend ещё не реализован — соответствующие endpoints входят в каталог как `TZ-MUST` / `UI_MISSING`.

## Какие документы находятся в папке и в каком порядке их читать

1. **README.md** (этот файл) — точка входа.
2. **[Phase_1_Owner_Organization_Admin_Backend_Handoff.md](./Phase_1_Owner_Organization_Admin_Backend_Handoff.md)** — основной документ: границы Phase 1, модуль-карта Backend, мультиарендность, авторизация, транзакции, concurrency, audit/outbox, ошибки, пагинация, файлы, отчёты, health, порядок реализации, Definition of Done.
3. **[Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md)** — исчерпывающий каталог всех endpoint, необходимых для интеграции Phase 1, с DTO, policy, ошибками, статусом интеграции с Frontend.
4. **[Phase_1_Controller_Service_Map.md](./Phase_1_Controller_Service_Map.md)** — Controller → Application Service → транзакция → Audit/Outbox для каждого модуля.
5. **[Phase_1_TZ_Traceability_Matrix.md](./Phase_1_TZ_Traceability_Matrix.md)** — соответствие Requirement ID ТЗ ↔ страница ↔ endpoint ↔ классификация.
6. **[Phase_1_Backend_Implementation_Checklist.md](./Phase_1_Backend_Implementation_Checklist.md)** — практический чеклист реализации по модулям.
7. **[Phase_1_Product_Extensions_and_Open_Questions.md](./Phase_1_Product_Extensions_and_Open_Questions.md)** — расхождения Frontend/ТЗ, product-approved расширения, открытые вопросы, требующие решения до реализации.

Рекомендуемый порядок чтения для Backend-разработчика, начинающего реализацию: 1 → 2 → 5 (проверить нормативную базу) → 3 → 4 → 6 → 7 (проверить открытые решения перед стартом).

## Следующие ролевые фазы

| Фаза | Роль | Статус |
|---|---|---|
| Phase 1 | Organization Admin (частично — Branch Admin) | Этот пакет |
| Phase 2 | Branch Admin (полноценный UI филиала) | Не начата |
| Phase 3 | Lead | Не начата |
| Phase 4 | Mentor | Не начата |

Phase 2–4 **переиспользуют инфраструктуру Phase 1**: мультиарендность (Organization/Branch/Category), авторизацию, AuditLog/Outbox, файловое хранилище, аналитику, health, конфигурацию (Приложение L ТЗ) — всё это создаётся один раз в Phase 1 и не дублируется. Новые требования следующих фаз (жизненный цикл Assignment, Submission, Review, расписание Topic/TopicAssignment для Lead/Mentor) оформляются как **Backend delta** к настоящему пакету, а не как отдельный документ с нуля.

## Источники истины

1. [`MentorTaskFlow_TZ_v2.2.md`](../MentorTaskFlow_TZ_v2.2.md) — нормативное ТЗ.
2. [`ADR-001-organization-branch-isolation.md`](../ADR-001-organization-branch-isolation.md) — архитектурное решение по изоляции Organization/Branch.
3. Текущий Frontend `Frontend/src/pages/admin/*`, `Frontend/src/features/admin-*` — реализованная и утверждённая владельцем продуктовая работа.
4. `Frontend/src/mocks/*`, `Frontend/src/api/*` — preview-контракты и уже реализованный typed-клиент Auth-домена.
5. `Frontend/openapi/mentortaskflow-auth.yaml` — единственная опубликованная часть OpenAPI (только Auth).

При конфликте между ТЗ и Frontend приоритет имеет ТЗ; расхождения зафиксированы явно и не скрыты внутри обычных `TZ-MUST` записей — см. [Phase_1_Product_Extensions_and_Open_Questions.md](./Phase_1_Product_Extensions_and_Open_Questions.md).
