# Phase 1 — Product Extensions and Open Questions

Документ фиксирует всё, что не сводится к прямому «ТЗ говорит X → реализуем X»: продуктовые расширения текущего Frontend, требования ТЗ без UI, открытые вопросы уровня архитектуры и решения, требующие Product/Architecture до начала реализации соответствующего backend-эндпоинта. Ни одно расхождение не квалифицируется здесь как ошибка Frontend — формулировки нейтральны: «функция подтверждена текущим продуктовым UI, но требует фиксации в следующей версии ТЗ» либо «ТЗ явно исключает функцию в текущей редакции, реализация которой видна в UI как прототип».

Каждый пункт использует ту же систему из двух независимых осей, что и [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md): **Req. classification** (`TZ-MUST`/`PRODUCT-APPROVED EXTENSION`/`FUTURE PHASE`/`OUT OF SCOPE`) и **Decision status** (`CONFIRMED`/`PRODUCT DECISION REQUIRED`). Отсутствие кнопки или страницы во Frontend само по себе **не является** основанием для `PRODUCT DECISION REQUIRED` — см. правило в начале раздела 2 каталога; такие случаи выделены в раздел 2 этого документа с пометкой `Backend = REQUIRED`.

---

## 1. Product-approved extensions

### 1.1. Дополнительные поля формы создания/редактирования Branch

- **UI location**: `/admin/branches` → «Создать филиал» / «Редактировать филиал» (`Frontend/src/features/admin-branches/branchForm.schema.ts`).
- **Purpose**: форма собирает `city`, `email`, `phone` — операционные контакты филиала, которых нет в модели `Branch` ТЗ (раздел 10.18: `Name, Code, Address, TimeZoneId, IsHeadOffice, IsActive`).
- **Proposed endpoint**: расширить `CreateBranchRequest`/`BranchDto`/`PUT /branches/{id}` тремя опциональными полями `city`, `contactEmail`, `contactPhone`, либо расширить существующее поле `Address` до структурированного объекта `{city, street, contactEmail, contactPhone}`.
- **Backend impact**: миграция схемы `branches` (3 доп. колонки), обновление `CreateBranchRequest`/`BranchDto` в OpenAPI и Приложении D.0.
- **Security impact**: нет — не tenant-scope поля, не PII третьих лиц.
- **Suggested TZ amendment**: добавить `city`, `contactEmail`, `contactPhone` в таблицу 10.18 как опциональные поля, либо явно решить, что `Address` — свободный текст, куда город и контакты должны вписываться вручную (тогда UI следует упростить до одного поля вместо четырёх).

### 1.2. Назначение администратора филиала при создании Branch

- **UI location**: та же форма — `adminOption: 'none'|'existing'` + `adminUserId`.
- **Purpose**: объединить в одном UI-шаге создание филиала и назначение ему администратора — сокращает количество кликов.
- **Proposed endpoint**: не новый endpoint. Backend реализует как **два последовательных вызова** от Frontend: `POST /branches`, затем (если `adminOption='existing'`) `POST /users/{adminUserId}/change-role` (`BranchId`=созданный филиал, `AdminScope='Branch'`). Не проектировать как единую транзакцию — ТЗ не описывает такую атомарную операцию, а совмещение усложнило бы откат при частичной ошибке.
- **Backend impact**: нет нового backend-кода сверх уже описанных `POST /branches` и `change-role`.
- **Security impact**: нет, если Frontend корректно обрабатывает частичный сбой (филиал создан, назначение админа не удалось) отдельным сообщением, а не одной операцией.
- **Suggested TZ amendment**: не требуется — это Frontend-оркестрация существующих endpoint.

### 1.3. «Change Branch Admin» / «Change Lead» с явным выбором судьбы предыдущего администратора

- **UI location**: `/admin/branches` («Change branch admin», параметр `previousAdminRoleChoice: Lead|Mentor|Deactivate`) и `/admin/categories` («Change lead», параметр `PreviousLeadFate: Mentor|Transfer|Deactivate`).
- **Purpose**: ТЗ описывает смену Lead/Branch Admin как обычный `change-role`, но не диктует, что делать с предыдущим носителем роли — UI делает этот выбор явным и обязательным, что снижает риск «зависшего» администратора без роли.
- **Proposed endpoint**: не новый — два-три последовательных вызова `POST /users/{id}/change-role` (или `deactivate`), инициируемых Frontend.
- **Backend impact**: нет.
- **Security impact**: нет.
- **Suggested TZ amendment**: раздел 39.5/15.1 можно дополнить рекомендацией UX (не нормативным требованием) о явном выборе судьбы предыдущего администратора — не обязательно, но полезно зафиксировать как согласованный паттерн для Phase 2/3, где повторится тот же вопрос для Lead.

### 1.4. Агрегатный `GET /api/v1/admin/dashboard`

- **UI location**: `/admin/dashboard` — единственная страница, уже реально интегрированная.
- **Purpose**: один запрос отдаёт KPI, тренды, branch health, category health, top mentors, recent activity и т.д. вместо композиции из `/reports/team`, `/admin/audit-log`, `/admin/notifications` и т.д.
- **Proposed endpoint**: `GET /api/v1/admin/dashboard?period=` уже существует как контракт (типы в `Frontend/src/api/admin/dashboard.ts:10-164`) и уже используется MSW. Комментарий в MSW-обработчике сам отмечает: «в реальном backend это, вероятнее всего, композиция нескольких вызовов» — то есть Frontend не настаивает на буквальной реализации одним SQL-запросом.
- **Backend impact**: либо один агрегирующий endpoint (BFF-паттерн для этой страницы), либо Backend Controller, композирующий несколько Application Service вызовов за один HTTP round-trip. Решение — на усмотрение Backend-архитектуры, контракт ответа (JSON-форма) фиксирован Frontend-типами и менять его не следует без согласования.
- **Security impact**: нет сверх уже описанного для `/reports/*`, `/admin/audit-log`, `/admin/notifications`.
- **Suggested TZ amendment**: добавить `GET /admin/dashboard` в Приложение D.7 ТЗ как отдельный нормативный endpoint (сегодня формально отсутствует в Приложении D — Dashboard не упомянут как отдельный контракт, хотя фактически уже частично «в production» на уровне MSW).

### 1.5. Экспорт отчётов (`/admin/reports` → «Экспортировать»)

- **Req. classification**: `PRODUCT-APPROVED EXTENSION`. **Decision status**: `PRODUCT DECISION REQUIRED`.
- **UI location**: `/admin/reports` → кнопка «Экспортировать» + модал выбора формата (`csv|pdf`) и секций.
- **Purpose**: владелец продукта подтвердил полезность выгрузки отчёта во внешний файл — функциональность уже присутствует в утверждённом UI-прототипе, а не является случайной находкой.
- **Текущее расхождение с ТЗ**: раздел 5 ТЗ («Вне рамок Release 1.0») сегодня явно перечисляет «Экспорт отчётов в PDF/Excel» как не входящий в Release 1.0. Это не квалифицируется как ошибка Frontend — это функция, подтверждённая текущим продуктовым UI, но требующая фиксации в следующей версии ТЗ.
- **Proposed endpoint**: `POST /reports/export` (или `GET` с теми же query-параметрами, что `GET /reports/team`, плюс `format`/`sections`) — точный маршрут, HTTP-метод и формат ответа (синхронный файл vs асинхронная генерация + ссылка) не определены и требуют отдельного проектирования.
- **Backend impact**: новый Application Service (`IReportExportService`), выбор библиотеки генерации CSV/PDF, лимиты размера отчёта, вероятно — фоновая генерация для больших выборок.
- **Security impact**: экспорт наследует scope запроса и не должен расширять его (по аналогии с `TEN-075`, которая уже сформулирована в ТЗ для гипотетического экспорта); нельзя допустить, чтобы экспорт в режиме Organization Admin «Все филиалы» тем не менее не включал колонку филиала.
- **Suggested TZ amendment**: перенести «Экспорт отчётов» из раздела 5 («Вне рамок Release 1.0») в раздел 4 («Состав системы Release 1.0») с добавлением нормативного описания endpoint в Приложение D — до этой правки backend endpoint **не реализуется** в Phase 1, несмотря на одобрение продукта, так как контракт ещё не определён.

---

## 2. Requirements missing in UI

Для каждого пункта: **Req. classification = TZ-MUST**, **Decision status = CONFIRMED** (контракт полностью определён ТЗ), **Backend = REQUIRED** независимо от текущего статуса UI. Единственная переменная — колонка **Frontend status**, которая для всех пунктов ниже равна `UI_MISSING`. Это отличает данные пункты от раздела 3 «Conflicts», где именно контракт (не только UI) остаётся не до конца определён.

### 2.1. `ASN-025` — Force-cancel Assignment (Req. classification = TZ-MUST · Decision status = CONFIRMED · Frontend status = UI_MISSING · Backend = REQUIRED)

`ASN-006`/`ASN-025`/`BRN-033` прямо разрешают Organization Admin и Branch Admin принудительно отменять незавершённый Assignment своей Organization/Branch с обязательной причиной. `AssignmentsPage.tsx` сегодня **намеренно** сделана read-only — комментарий в коде подтверждает это явно («Admin здесь только наблюдает... read-only, без mutation store»).

**Требование не отменено отсутствием кнопки.** `POST /assignments/{id}/cancel` с `force=true` обязателен к реализации в Phase 1 backend (см. AS8 в [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md)). UI-кнопку можно добавить отдельным небольшим тикетом Frontend, не блокирующим остальной объём Phase 1, но backend не должен считать эту операцию частью Phase 3.

### 2.2. `BRN-005` — Назначение главного офиса (make-head-office) (Req. classification = TZ-MUST · Decision status = CONFIRMED · Frontend status = UI_MISSING · Backend = REQUIRED)

Endpoint нормативен (раздел 39.3), но соответствующей кнопки в `BranchesPage`/`BranchDetailsDrawer` не обнаружено. Backend реализует endpoint; вопрос о добавлении UI — к Product/Frontend, не блокирует Backend Phase 1.

### 2.3. `GET /reports/branches` — сравнение филиалов (Req. classification = TZ-MUST · Decision status = CONFIRMED · Frontend status = UI_MISSING · Backend = REQUIRED)

`TEN-070`/`TEN-073` описывают сравнение филиалов как доступное только Organization Admin. Явного визуального блока «сравнение филиалов» на `/admin/reports` исследование Frontend не обнаружило (только клиентские фильтры Branch/Category, не переключающие реальные данные). Backend реализует endpoint; необходимость отдельного UI-блока — Product Decision по UI, не по backend-контракту, и не обязательна для завершения Phase 1 backend.

### 2.4. Чистая смена категории пользователя без смены роли (Req. classification = TZ-MUST · Decision status = CONFIRMED · Frontend status = UI_MISSING · Backend = REQUIRED)

`USER-011`…`USER-017` описывают `POST /users/{id}/change-category` как самостоятельную операцию. В текущем UI функциональность видна только внутри диалога «Change role» (который включает категорию как часть смены роли). Endpoint необходим отдельно (например, перевод Mentor из категории A в категорию B того же филиала без изменения роли) — реализуется backend независимо от того, есть ли для него отдельная кнопка.

### 2.5. `/profile` — собственный профиль администратора (Req. classification = TZ-MUST · Decision status = CONFIRMED · Frontend status = UI_MISSING · Backend = REQUIRED)

Раздел 24.3 ТЗ описывает `/profile` как маршрут, общий для всех ролей (смена пароля, привязка/отвязка Telegram). Маршрута нет во Frontend; компонент `ChangePasswordForm.tsx` уже написан, но не смонтирован ни в один route. Endpoints (`POST /auth/change-password`, `POST/GET/DELETE /telegram/*`) входят в Phase 1 backend независимо от статуса Frontend-страницы.

---

## 3. Conflicts

### 3.0. Резюме расследования: создание Organization Admin — это НЕ gap (закрыто)

Первичное наблюдение («форма создания пользователя не позволяет выбрать роль Organization Admin») было перепроверено против bootstrap/invitation flow и **снято с рассмотрения как открытый вопрос**:

- Первый Organization Admin создаётся `mtf-migrator` bootstrap-процессом в одной транзакции с Organization и HeadOffice Branch (`DEPLOY-030`, раздел 32.6) — создание Organization в принципе невозможно без немедленного создания первого Organization Admin, независимо от какого-либо Admin UI.
- Второй и последующие Organization Admin создаются существующим Organization Admin через тот же `POST /users`, что и любой другой пользователь (`USER-031`: «Organization Admin → Organization Admin: Да (своя Organization)»). Endpoint U3 в [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md) полностью поддерживает этот сценарий (`Req. classification = TZ-MUST`, `Decision status = CONFIRMED`).

Единственное реальное наблюдение: текущая UI-форма `/admin/users` → «Создать пользователя» ограничивает выбор `role` значениями `BranchAdmin|Lead|Mentor` (`Frontend/src/features/admin-users/userForm.schema.ts:17-32`), не показывая вариант «Organization Admin». Это **Frontend UX-решение** (вероятно осознанное — снижает риск случайного создания второго Organization Admin через быструю форму), не backend-ограничение. **По правилу §6 ревью — отсутствие этого варианта в обычной форме не считается автоматическим gap**, backend-контракт не сужается под текущую форму. Если Product захочет добавить редкий, отдельно защищённый UI-путь для создания второго Organization Admin — это Frontend-задача, не требующая изменений backend-контракта.

### 3.1. Notifications/Integrations вкладки `/admin/settings` — уровень интеграции не определён

ТЗ принимает окончательное решение **не вводить** `OrganizationSettings` (`ORG-024`): «все настройки... относятся к уровню Category, а часовой пояс дополнительно — к уровню Branch... создание пустой сущности "на будущее" отклонено». Из этого **не следует автоматически**, что вкладки Notifications/Integrations нужно реализовывать как `OrganizationSettings` — это лишь один из трёх возможных уровней, и ниже они зафиксированы как открытый вопрос, а не как заранее решённый конфликт. Текущий `/admin/settings` содержит:

- вкладку **Notifications** с тремя переключателями (Email/Telegram/дедлайн-напоминания);
- вкладку **Integrations** с кнопками «Disconnect» для Email и Telegram.

**Открытый вопрос — на каком уровне должна жить эта функциональность:**

| Вариант | Описание | Требует правки ТЗ? |
|---|---|---|
| **System-level** | Значения полностью определяются переменными окружения `Features:Telegram`/`Features:AiSummary`/`Features:Scheduler` (Приложение L); Admin UI получает только `GET` для отображения текущего состояния, без возможности `PUT` | Нет — уже описано ТЗ как deploy-конфигурация |
| **Organization-level** | Вводится новая настройка на уровне Organization (например «включён ли канал Telegram для этой Organization») | Да — требует пересмотра `ORG-024`, который сегодня явно запрещает вводить `OrganizationSettings` |
| **Deployment-level (личное, не Admin UI)** | Подключение/отключение Email/Telegram выполняется только через переменные окружения при деплое, конкретная Organization вообще не участвует в решении; `/admin/settings` эти вкладки не должен показывать вовсе | Нет — соответствует `ORG-024` без изменений |

**Рекомендация**: не создавать backend для этих двух вкладок в Phase 1, пока Product/Architecture не выберет один из трёх вариантов. `DELETE /telegram/binding` (уже в каталоге, A11) существует только для отвязки **личного** Telegram-аккаунта текущего пользователя и не решает вопрос об org-level или system-level переключателе — это разные операции, которые не следует путать.

**Status**: `Open question — Product Decision Required`, не финализировано ни в чью пользу.

### 3.2. `PreviewUserRole` не соответствует реальной модели ролей

Preview-фикстуры (`Frontend/src/mocks/ui-preview/users.preview.ts`) используют плоский набор ролей `OrgAdmin|BranchAdmin|Lead|Mentor`, тогда как реальный, уже используемый в Auth-домене тип — `role: 'Admin'|'Lead'|'Mentor'` + `adminScope: 'Organization'|'Branch'|null` (`Frontend/src/api/generated/auth-api.ts`). Это разные модели одного и того же понятия внутри одного Frontend-репозитория.

**Рекомендация**: backend ориентируется исключительно на модель `Role`+`AdminScope`, уже подтверждённую Auth-доменом и ТЗ (`TEN-011`, раздел 8.5). При подключении `UsersPage`/`admin-users` к реальному API Frontend-команда обязана привести `PreviewUserRole` к `Role`+`AdminScope` — это Frontend-рефакторинг, не Backend-задача, но фиксируется здесь, так как иначе DTO не совпадут при интеграции.

**Status**: `Implementation detail — Frontend alignment needed at integration time, no backend ambiguity`.

### 3.3. «Block»/«Unblock» пользователя как отдельное действие

**Req. classification**: `PRODUCT-APPROVED EXTENSION` (концепция Block/Unblock подтверждена текущим UI, прямого требования ТЗ нет). **Decision status**: `PRODUCT DECISION REQUIRED` — окончательная backend-модель **не утверждается** этим документом.

UI `/admin/users/:id` предлагает четыре разных состояния-действия: Activate, Deactivate, Block (с обязательной причиной из taxonomy `suspicious|violation|temporary|other` + комментарий), Unblock. ТЗ определяет только:
- `IsActive` (`true`/`false`) через `POST /users/{id}/activate|deactivate` (`USER-004`, `USER-007`);
- автоматическую блокировку входа `LockoutUntil` после 5 неудачных попыток входа (`AUTH-024`) — это **системное**, не административное действие, без указания причины и без ручного управления администратором.

Отдельного, вручную устанавливаемого «заблокирован администратором с причиной» состояния в модели `User` (раздел 10.1) нет. ТЗ **не определяет**, чем «Block» должен отличаться от «Deactivate» по семантике — этот документ намеренно не восполняет пробел domain-решением.

**Явно различаются два нерешённых вопроса, которые нельзя схлопывать в один ответ:**
1. **Отличается ли Block от Deactivate по бизнес-смыслу?** (Например: деактивированный пользователь — «уволен/переведён», заблокированный — «временно отстранён с намерением вернуть». Если да — нужен отдельный атрибут состояния.)
2. **Если отличий по смыслу нет** — тогда единственная разница между «Block» и «Deactivate» в UI — это формулировка кнопки и обязательность `reasonCategory`, и тогда backend может переиспользовать `Deactivate`/`Activate` (U6/U5 в каталоге) с `reason`/`reasonCategory`, пишущимися в `AuditLog.Metadata`.

Обе гипотезы технически реализуемы; предпочтение одной из них — **решение Product**, не архитектурный вывод из ТЗ. До получения ответа backend не должен реализовывать ни одну из веток как окончательную — эндпоинты `activate`/`deactivate` (U5/U6) реализуются в их существующем, определённом ТЗ виде (без нового состояния `UserStatus`), а вопрос Block/Unblock остаётся отдельно зафиксированным открытым пунктом, не закрывающим тему.

**Status**: `Product Decision Required` — модель не финализирована.

### 3.4. Admin-инициированная ссылка сброса пароля для уже активного пользователя

**Req. classification**: `PRODUCT-APPROVED EXTENSION`. **Decision status**: `PRODUCT DECISION REQUIRED`.

UI `/admin/users/:id` → «Send password-reset link» подразумевает, что администратор может для **уже входившего** пользователя (с установленным паролем) инициировать сброс. ТЗ определяет:
- `POST /auth/forgot-password` — только самообслуживание, анонимно, по инициативе самого пользователя;
- `POST /users/{id}/resend-invitation` — переиздание `SetPassword`-токена, то есть только для пользователя, который **ещё не установил** пароль (`AUTH-022` описывает это именно так).

Admin-triggered reset для пользователя с уже установленным паролем отдельно не описан.

**Рекомендация**: расширить семантику `resend-invitation` — если `PasswordHash IS NOT NULL`, выпускать `UserSecurityToken(Purpose=ResetPassword)` вместо `SetPassword`, остальной контракт endpoint не меняется (тот же маршрут, тот же ответ 202). Альтернатива — новый endpoint `POST /users/{id}/send-password-reset`; решение зависит от того, хочет ли Product различать эти два сценария в AuditLog как разные `Action`.

**Status**: `Product Decision Required` — рекомендация: расширить `resend-invitation`, не вводить новый маршрут, если не требуется разделение в AuditLog.

### 3.5. `notificationLanguage` в форме редактирования пользователя

**Req. classification**: `PRODUCT-APPROVED EXTENSION`. **Decision status**: `PRODUCT DECISION REQUIRED`.

`PATCH /users/{id}` формы Frontend содержит поле `notificationLanguage`, отсутствующее в модели `User` ТЗ (раздел 10.1: `FullName, Email, PasswordHash, Role, AdminScope, OrganizationId, BranchId, CategoryId, TelegramChatId, TokenVersion, IsActive, FailedLoginCount, LockoutUntil, LastLoginAt`). ТЗ вообще не описывает язык интерфейса как атрибут пользователя (раздел 5: «Мультиязычный интерфейс (i18n) — вне рамок Release 1.0», интерфейс только на русском).

**Рекомендация**: не добавлять `notificationLanguage` в модель `User` без отдельного product decision. Возможные пути: (a) поле удаляется из формы как относящееся к нереализованной i18n-функциональности; (b) поле добавляется в `User` как задел на будущее — сознательно противоречит принципу «не создавать сущности/поля впрок», зафиксированному для `OrganizationSettings` (`ORG-024`) тем же ТЗ, поэтому не рекомендуется без явного запроса Product.

**Status**: `Product Decision Required`.

### 3.6. `IncidentHistoryModal` на `/admin/health`

**Req. classification**: `PRODUCT-APPROVED EXTENSION`. **Decision status**: `PRODUCT DECISION REQUIRED`.

Отдельной сущности «Incident» ТЗ не определяет. Health-модуль ограничен `GET /health/live`/`/health/ready` с текущим статусом зависимостей (раздел 30.1) — никакой истории состояний не хранится отдельно.

**Рекомендация**: не создавать новую таблицу/сущность `Incident`. Наполнить модал производной выборкой из `AuditLog`/`NotificationOutbox` по системным событиям (`OrganizationSystemAlert`, `NotificationDeadLetter`) — данные уже существуют благодаря Outbox/Audit модулям Phase 1, отдельного backend-модуля не требуется.

**Status**: `Implementation detail decision` — рекомендация: переиспользовать AuditLog, не заводить новую сущность.

### 3.7. Health-страница и Dashboard используют две разные фикстуры

Не конфликт с ТЗ, а внутренняя рассогласованность Frontend: `/admin/health` (`PREVIEW_SERVICES`) и блок `systemHealth` на `/admin/dashboard` (`Frontend/src/mocks/domain/health.ts`) сегодня — независимые, несинхронизированные фикстуры с ручной нормализацией идентификатора сервиса (`postgres↔db`). Backend обязан предоставить **один** `GET /health/ready` контракт; обе точки Frontend при интеграции должны читать один и тот же endpoint. Это не Backend-задача исправлять Frontend, но Backend не должен проектировать два разных API под эти два места.

**Status**: `Implementation detail` — зафиксировано для координации с Frontend-командой на этапе интеграции.

---

## 4. Decisions required before Backend implementation

Сводный список открытых вопросов, требующих ответа Product/Architecture до начала соответствующей части реализации (не блокирует Foundation/Auth/Organizations/Branches(base)/Users(base)/Categories). Каждая строка соответствует записи `PRODUCT DECISION REQUIRED` из [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md) (либо из основного счёта 57 endpoint, либо из реестров UI-оркестрации/открытых вопросов при соответствующих модулях) — итого **9 пунктов**, что совпадает с суммой всех `PRODUCT DECISION REQUIRED`-пометок каталога (4 в основном счёте + 5 в реестрах модулей).

| # | Вопрос | Блокирует | Связанный endpoint в каталоге | Временная рекомендация |
|---|---|---|---|---|
| 1 | Добавлять ли `city/contactEmail/contactPhone` в модель Branch? | `POST /branches` окончательный DTO | B2 | Добавить как опциональные поля (низкий риск); не блокирует реализацию базового TZ-контракта |
| 2 | Судьба `notificationLanguage` в `User`? | `PATCH /users/{id}` DTO | U4 | Не добавлять в `User` до отдельного решения; базовый контракт (`fullName`) реализуется уже сейчас |
| 3 | Выделять ли `GET /admin/notifications/{id}` отдельным endpoint или встраивать payload в элемент списка `GET /admin/notifications`? | Финальная форма `NotificationOutboxDetailsDto` | N2 | Реализовать отдельным endpoint (проще эволюционировать), но не блокирует остальные Notifications-endpoints |
| 4 | Экспорт отчётов — формат ответа, маршрут, синхронный/асинхронный | `POST /reports/export` (контракт не существует) | R5 | Не реализовывать backend, пока контракт не спроектирован и раздел 5 ТЗ не обновлён; функция уже одобрена продуктом как расширение |
| 5 | Как реализовать «Block/Unblock»: алиас Deactivate/Activate или новое состояние `UserStatus`? | Семантика, не сам контракт `activate`/`deactivate` (U5/U6 реализуются в определённом ТЗ виде уже сейчас) | реестр Users §4 каталога | Решение не принимается этим документом — см. §3.3 выше |
| 6 | Нужен ли endpoint admin-triggered password reset для активного пользователя, отдельный от `resend-invitation`? | Финальный контракт `resend-invitation` | реестр Users §4 каталога | Расширить `resend-invitation` условием по `PasswordHash`, если Product не потребует раздельного AuditLog-действия |
| 7 | Вкладки Notifications/Integrations на `/admin/settings` — system-level, organization-level (требует пересмотра `ORG-024`) или deployment-level? | Весь backend вкладок Settings кроме `PUT /organization` | реестр Settings §11 каталога | Не реализовывать backend для этих вкладок, пока не выбран один из трёх уровней — см. §3.1 выше |
| 8 | `IncidentHistoryModal` — переиспользовать AuditLog/Outbox или вводить `Incident`? | Backend для этого модала | реестр Health §10 каталога | Переиспользовать AuditLog |
| 9 | «Кандидаты на роль Lead» — нужен ли серверный фильтр `eligibleForLead` в `GET /users`, или диалог работает на обычном списке? | Необязательное расширение `GET /users` | реестр Categories §5 каталога | Не обязателен для Phase 1; диалог может использовать обычный список пользователей |

**Не входит в этот список** (расследовано и закрыто, см. §3.0): создание Organization Admin через `POST /users` — backend-контракт уже полностью поддерживает сценарий (`USER-031` + bootstrap `DEPLOY-030`), открытого вопроса на стороне backend нет.

---

## 5. Future phase items

Перечислено для полноты картины, чтобы не путать с Phase 1 (детальный дизайн — вне scope этого пакета, см. раздел 32 задания):

- Создание/публикация/переназначение/отмена (без force) Assignment — Phase 3 (Lead).
- Приём предложений планировщика (Suggested → Assigned/Cancelled) — Phase 3.
- Старт Review и вынесение решения (`start-review`, `POST /submissions/{id}/reviews`) — Phase 3.
- Расписание Topic/TopicAssignment (создание/редактирование) — Phase 3.
- Загрузка Submission — Phase 4 (Mentor).
- Личный кабинет и личная аналитика Mentor — Phase 4.
- Авто-генерация Assignment по расписанию (Hangfire BDA) — Phase 3/7 по плану фаз ТЗ; в Phase 1 создаётся только инфраструктурный каркас (Hangfire host, health-проверка планировщика).

---

## 6. Итоговая статистика (сверено с Phase_1_API_Endpoint_Catalog.md)

- **Endpoints в основном каталоге Phase 1**: 57 (56 `TZ-MUST` + 1 `PRODUCT-APPROVED EXTENSION`).
- **Decision Status по каталогу**: 53 `CONFIRMED` + 4 `PRODUCT DECISION REQUIRED` (B2, U4, N2, R5).
- **Подтверждённые продуктовые расширения** (раздел 1 этого документа): 5 — доп. поля Branch (§1.1), назначение админа при создании филиала (§1.2, оркестрация), Change Branch Admin/Change Lead с выбором судьбы предыдущего (§1.3, оркестрация), агрегатный dashboard (§1.4), экспорт отчётов (§1.5).
- **Открытые вопросы, требующие Product Decision** (раздел 4): 9.
- **Требования ТЗ без UI, но подтверждённые как обязательные к реализации backend** (раздел 2): 5 (ASN-025, BRN-005, `/reports/branches`, чистая смена категории, `/profile`).
- **Закрыто как не-gap** (раздел 3.0): создание Organization Admin через `POST /users` — 1 пункт.

Числа этого раздела идентичны итоговой таблице [Phase_1_API_Endpoint_Catalog.md](./Phase_1_API_Endpoint_Catalog.md) («Итоговая статистика каталога») и не должны расходиться при последующих правках — при изменении одного документа обязательно обновлять оба.
