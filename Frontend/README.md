# MentorTaskFlow — Authentication & Session Management

Первый модуль SPA: React 18 + TypeScript strict + Vite. Backend отсутствует, весь
`/api/v1/auth/*` отдаёт MSW — но по контракту из `openapi/mentortaskflow-auth.yaml`,
из которого генерируются и типы приложения.

## Запуск

```bash
npm install
npm run dev            # http://localhost:5173
npm run typecheck
npm run lint
npm test
npm run build          # tsc + vite build + verify:bundle
npm run verify:bundle  # отдельная проверка dist на артефакты dev-контура
npm run api:generate   # перегенерация типов из OpenAPI
```

`npm run build` завершается проверкой `scripts/verify-bundle.mjs`: сборка падает,
если в `dist/` встретится `setupWorker`, `setupServer`, `mockServiceWorker`,
`mtfMocks`, ключ dev-персистентности моков, тестовый email `*@mentortaskflow.test`,
пароль `DemoPassword1!`, любой development security token или импорт MSW.
Сам `public/mockServiceWorker.js` нужен только dev-режиму и удаляется из сборки
плагином `mtf:strip-mock-worker`.

## Переход на реальный backend

Меняются ровно две переменные окружения — код компонентов, хуков, AuthProvider
и axios-клиентов не трогается:

```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://api.<domain>
```

`VITE_API_BASE_URL` не содержит версию: пути эндпоинтов уже начинаются с `/api/v1/`.
Пустая строка = same-origin. При `VITE_USE_MOCKS != true` (или в production-сборке)
динамический импорт MSW недостижим и вырезается сборщиком — проверено:
`setupWorker` в `dist/assets/*.js` отсутствует.

Когда backend отдаст общий OpenAPI — меняется только источник в скрипте `api:generate`.

## Маршруты

| Путь | Доступ |
|---|---|
| `/login` | публичный; аутентифицированного уводит на дашборд его роли |
| `/forgot-password` | публичный |
| `/reset-password?token=…` | публичный |
| `/set-password?token=…` | публичный |
| `/admin/dashboard` | `RequireAuth` + `RequireRole(['Admin'])` |
| `/lead/dashboard` | `RequireAuth` + `RequireRole(['Lead'])` |
| `/mentor/dashboard` | `RequireAuth` + `RequireRole(['Mentor'])` |

Публичной регистрации нет: маршрута `/register` не существует, он попадает
в catch-all и уводит на `/login`. Роль для redirect берётся только из ответа API.

До завершения bootstrap ни один guard не делает redirect — вместо этого
показывается полноэкранный `AuthBootstrapScreen`.

## Хранение сессии

| Что | Где | Кто читает |
|---|---|---|
| `accessToken` | переменная модуля `src/auth/tokenStore.ts` | только axios-интерцептор |
| refresh-токен | HttpOnly cookie `mtf_rt` | никто из кода приложения |
| CSRF-токен | cookie `mtf_csrf` (не HttpOnly) | `readCsrfToken()` → заголовок `X-CSRF-Token` |

Ни localStorage, ни sessionStorage, ни IndexedDB, ни persisted Query Cache.
ESLint запрещает обращения к `localStorage`/`sessionStorage` в коде приложения.
После reload access-токена нет — это нормально, сессия поднимается silent refresh'ем.

### Атрибуты cookie (окончательно)

```
mtf_rt:   HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; host-only; Max-Age=1209600
mtf_csrf: Secure; SameSite=Strict; Path=/;              non-HttpOnly; host-only
```

Разные `Path` — не опечатка. `mtf_rt` нужна только эндпоинтам `/api/v1/auth`,
а `mtf_csrf` обязана быть читаемой из `document.cookie` на любой странице SPA,
иначе double-submit невозможен.

> В первоначальном frontend-промте для `mtf_csrf` был ошибочно указан
> `Path=/api/v1/auth`. Основное ТЗ этого не требовало; значение исправлено
> на `Path=/` и зафиксировано выше, в `openapi/mentortaskflow-auth.yaml`
> и в `src/mocks/cookies.ts`.

## Архитектура HTTP-слоя

```
lib/            correlationId, cookies (leaf-модули)
api/problemDetails.ts     разбор ProblemDetails: code / errors / retryAfter / traceId
api/publicClient.ts       login, refresh, logout, forgot/reset/set-password
                          + X-Correlation-Id, + X-CSRF-Token для refresh и logout
                          БЕЗ авто-refresh — иначе провал refresh чинил бы сам себя
api/client.ts             apiClient: Bearer из tokenStore, 401-интерцептор
                          refresh-раннер приходит через setRefreshRunner (инъекция)
auth/refreshCoordinator   single-flight refresh; регистрирует себя в apiClient
auth/authEvents           шина: sessionExpired / tokenReuseDetected / loggedOut
auth/AuthProvider         единственный подписчик шины: чистит state и делает redirect
```

Циклических зависимостей нет: `client.ts` ничего не импортирует из `auth/`,
связь идёт в одну сторону через инъекцию раннера и шину событий.

### Правила 401

Авто-refresh запускается **только** для `TOKEN_EXPIRED` и `TOKEN_VERSION_MISMATCH`.
`INVALID_CREDENTIALS`, `UNAUTHORIZED`, `REFRESH_TOKEN_*`, `USER_DEACTIVATED`,
`CSRF_VALIDATION_FAILED` уходят наверх как есть.

| Исход refresh | Действие |
|---|---|
| успех | `_retried = true`, исходный запрос повторяется один раз |
| повторный 401 после refresh | logout-состояние, второй refresh не запускается |
| `REFRESH_TOKEN_INVALID` | `/login?reason=session-expired` |
| `REFRESH_TOKEN_REUSE_DETECTED` | `/login?reason=session-compromised`, без вызова logout |
| `CSRF_VALIDATION_FAILED` | `/login?reason=csrf-failed` |

Сколько бы параллельных запросов ни получили `TOKEN_EXPIRED`, `POST /auth/refresh`
уходит ровно один — остальные ждут тот же промис (покрыто тестом).

## Формат ошибок

Все ошибки — ProblemDetails, решения принимаются **только** по `code`:

```json
{
  "type": "https://mentortaskflow.example/problems/validation-failed",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "…",
  "instance": "/api/v1/auth/login",
  "traceId": "0f5c…",
  "errors": { "email": ["Введите корректный email"] }
}
```

`traceId` всегда равен заголовку `X-Correlation-Id` ответа: если клиент прислал свой —
возвращается он же, иначе генерируется новый. Для неизвестных ошибок traceId
показывается пользователю, тело ответа и стек — никогда.

## Тестовые данные моков

Пароль: `DemoPassword1!`

| Email | Сценарий |
|---|---|
| `admin@mentortaskflow.test` | обычный вход, Admin |
| `lead@mentortaskflow.test` | обычный вход, Lead |
| `mentor@mentortaskflow.test` | обычный вход, Mentor |
| `locked@mentortaskflow.test` | активный lockout → тот же `INVALID_CREDENTIALS` |
| `invited@mentortaskflow.test` | `PasswordHash = null` → тот же `INVALID_CREDENTIALS` |
| `reuse@mentortaskflow.test` | для сценария refresh token reuse |

Security-токены: `reset-valid-token`, `reset-expired-token`, `reset-used-token`,
`set-valid-token`, `set-expired-token`.

Account lockout (5 попыток → 15 минут, ответ 401) и route rate limiting
(10/мин на login, 5/час на forgot, 10/час на reset и set, ответ 429 + `Retry-After`) —
разные механизмы и реализованы отдельно.

### Ручной QA — `window.mtfMocks`

```js
mtfMocks.expireAccessTokens()   // следующий запрос уйдёт в silent refresh
mtfMocks.bumpTokenVersion(email)// TOKEN_VERSION_MISMATCH
mtfMocks.lockAccount(email) / mtfMocks.unlockAccount(email)
mtfMocks.issueResetLink(email)  // свежая ссылка сброса
mtfMocks.issueInviteLink(email) // свежая ссылка приглашения
mtfMocks.clearRateLimits()
mtfMocks.reset()                // сброс состояния моков
mtfMocks.state()                // дамп: users, refreshSessions, securityTokens, auditEvents
```

Сценарии, которые стоит прощёлкать руками:

1. Вход каждой ролью → проверить redirect и `/auth/me` на дашборде.
2. **Настоящий F5 на дашборде** → должен остаться дашборд, а в Network пройти
   `POST /auth/refresh` → `GET /auth/me`. В консоли появится
   `[MSW] Моки включены (состояние сессии восстановлено после перезагрузки)`.
3. 5 неверных попыток для `reuse@…` → lockout; текст ответа не меняется.
4. `mtfMocks.expireAccessTokens()` → нажать «Сменить пароль» → silent refresh в Network.
5. `mtfMocks.bumpTokenVersion('admin@mentortaskflow.test')` → следующий запрос
   уводит на `/login?reason=session-expired`.
6. Открыть `/reset-password?token=reset-expired-token` → экран «Ссылка недействительна».
7. DevTools → Network → Offline → форма блокируется, появляется баннер.
8. Прогнать `mtfMocks.clearRateLimits()` и 11 попыток входа подряд → 429 с countdown.
9. `mtfMocks.reset()` + F5 → состояние моков и сессия сброшены.

## Оговорки по mock-слою

Это осознанные решения, а не упущения:

1. **HttpOnly в MSW — эмуляция, не криптография.** Страница не может выдать себе
   настоящую HttpOnly-cookie. Поэтому `mtf_rt` вообще не попадает в `document.cookie`:
   её значение живёт в переменной `src/mocks/cookies.ts`, доступной только хендлерам.
   Для кода приложения она физически недостижима. `mtf_csrf` — настоящая cookie,
   как и в production.

2. **Состояние mock-сервера переживает reload — намеренно.** `src/mocks/persistence.ts`
   складывает в `sessionStorage` серверную сторону мока: `users`, `refreshSessions`,
   `securityTokens`, `rateLimitBuckets`, `auditEvents` и непрозрачное значение
   cookie `mtf_rt`. Без этого MSW, живущий внутри страницы, забывал бы выданную
   сессию на каждом F5 и цепочку `refresh → me → authenticated` нельзя было бы
   проверить руками.

   Чего там нет и не будет: **accessToken** (он обязан пропадать при reload)
   и профиль пользователя как клиентское состояние — после перезагрузки он заново
   приезжает из `GET /auth/me`. Персистентность включается только при
   `import.meta.env.DEV && VITE_USE_MOCKS === 'true'`, живёт целиком внутри
   `src/mocks/`, и код приложения о ней не знает: ESLint запрещает ему
   `sessionStorage`, а исключение выдано ровно одному файлу.
   Сохранение происходит в единственной точке — подписке на `response:mocked`
   в `browser.ts`, хендлеры об этом не знают. Сценарий покрыт тестом.

3. **MSW держит собственный cookie-store в localStorage.** Ключ
   `__msw-cookie-store__` создаёт сама библиотека, реагируя на заголовки
   `Set-Cookie` в ответах (у нас — гашение `mtf_csrf` с `Max-Age=0`).
   Ни токенов, ни `mtf_rt` там нет, а в production-сборке MSW отсутствует целиком.
   Тест проверяет именно это: в браузерных хранилищах нет ни одного access-токена,
   а в localStorage не появляется ничего, кроме ключа самой MSW.

4. **Порядок проверок в `/auth/refresh`.** Сначала проверяется наличие refresh-cookie
   (нет → `401 REFRESH_TOKEN_INVALID`), и только потом CSRF (`403`). Иначе первый
   визит анонимного пользователя получал бы `CSRF_VALIDATION_FAILED` и баннер
   о непройденной проверке безопасности. Все случаи CSRF из контракта — отсутствие
   заголовка, отсутствие cookie, несовпадение — сохранены для запросов с сессией.

## Тесты

`npm test` — 32 кейса, включая все 20 обязательных: ролевые redirect'ы,
единый текст отказа для трёх разных причин, countdown по `Retry-After`,
одинаковый экран forgot-password, invalid-link screen, отсутствие
предварительного GET на `/set-password`, отсутствие токенов в браузерных
хранилищах, bootstrap `refresh → me`, single-flight (5 параллельных 401 → 1 refresh),
отсутствие второго refresh, reuse detection, CSRF 403, очистка кэша при logout,
блокировка submit в оффлайне, доступность публичных страниц и оба guard-а.

Отдельно закрыты два пункта hardening'а:

* **StrictMode** — двойное монтирование `AuthProvider` даёт ровно один
  `POST /auth/refresh` и один `GET /auth/me`. Защиты две: единый bootstrap-промис
  в ref провайдера и single-flight в `refreshCoordinator`.
* **Reload** — снапшот mock-сервера восстанавливается, приложение проходит
  `refresh → me → authenticated`, при этом access-токен после перезагрузки новый
  и ни он, ни предыдущий в хранилищах не встречаются.

## Структура

```
openapi/mentortaskflow-auth.yaml   контракт (источник генерации типов)
src/
  api/            client.ts, publicClient.ts, auth.ts, problemDetails.ts, generated/
  auth/           AuthProvider, useAuth, tokenStore, authEvents, refreshCoordinator,
                  roleRedirect, RequireAuth, RequireRole, authContext
  components/auth/ AuthCard, LoginForm, ForgotPasswordForm, PasswordSetupForm,
                  ChangePasswordForm, PasswordStrengthHint, AuthError, SubmitButton,
                  BrandLogo, AuthBootstrapScreen, MockCredentialsHint
  components/ui/  TextField (+PasswordField), Spinner
  hooks/          useOnlineStatus, useRateLimitCountdown
  lib/            correlationId, cookies
  mocks/          browser.ts, server.ts, db.ts, tokens.ts, rateLimit.ts,
                  scenarios.ts, cookies.ts, persistence.ts, handlers/auth.ts
scripts/
  verify-bundle.mjs                проверка dist на артефакты dev-контура
  pages/auth/     LoginPage, ForgotPasswordPage, ResetPasswordPage, SetPasswordPage
  routes/         AppRouter.tsx
  schemas/        auth.schema.ts
  test/           setup.ts, utils.tsx, *.test.tsx
```
