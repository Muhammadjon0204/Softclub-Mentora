# RAVAND — мобильное приложение ментора

Expo (SDK 58) + Expo Router + TypeScript. Тот же API, что у сайта (`tmsapi.softclub.tj`), вход по
отдельным эндпоинтам `/api/v1/auth/mobile/*` — refresh-токен хранится в Keychain/Keystore
(`expo-secure-store`), а не в cookie.

Сейчас в приложении: вход, «Мои задания» (по срочности: просрочено → сегодня → неделя → позже →
на проверке → завершённые), карточка задания с историей, профиль (язык ru/tg/en, выход). Тема
следует настройкам телефона. Сдача работы пока открывает сайт.

## Запуск на телефоне

1. Установите **Expo Go** из App Store / Google Play.
2. В этой папке:

   ```bash
   npm install
   npx expo start
   ```

3. Отсканируйте QR-код камерой (iPhone) или из Expo Go (Android). Телефон и Mac — в одной Wi-Fi сети.

По умолчанию приложение ходит в боевой API. Пока `/auth/mobile/*` не выкатан на сервер, запускайте
против локального бэкенда (`Backend/`, `docker compose up -d`), указав IP вашего Mac:

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:5050 npx expo start
```

## Сборка и раздача тестировщикам (EAS)

Собирает облако Expo (EAS) — Xcode и Android Studio не нужны. Профили — в `eas.json`:
`preview` (Android APK по ссылке) и `production` (iPhone через TestFlight). Обе сборки ходят в
боевой API `tmsapi.softclub.tj`, поэтому на сервере уже должен быть образ API с `/auth/mobile/*`.

### Один раз

1. Заведите бесплатный аккаунт на https://expo.dev.
2. В этой папке:

   ```bash
   npx eas-cli@latest login
   ```

   ```bash
   npx eas-cli@latest init
   ```

   `init` создаёт проект в Expo и дописывает его `projectId` в `app.json` — это изменение
   закоммитьте.

### Android — ссылка на APK (бесплатно, без магазина)

```bash
npx eas-cli@latest build --platform android --profile preview
```

В конце будет ссылка и QR-код. Открываете на Android-телефоне → скачиваете → разрешаете установку
из этого источника. Ссылку можно разослать всем, у кого Android.

### iPhone — TestFlight

Нужна платная подписка **Apple Developer Program** ($99 в год, https://developer.apple.com/programs/).
На организацию Apple требует D-U-N-S номер и проверка идёт несколько дней; на физлицо — быстрее.

```bash
npx eas-cli@latest build --platform ios --profile production
```

EAS спросит Apple ID и сам создаст сертификаты. Затем:

```bash
npx eas-cli@latest submit --platform ios --latest
```

Сборка появится в App Store Connect → TestFlight (обработка 10–30 минут). Дальше:

- **Внутреннее тестирование** — до 100 человек из вашей команды в App Store Connect, без проверки Apple.
- **Внешнее** — до 10 000 человек по email или публичной ссылке; первую сборку Apple проверяет
  (обычно до суток). Для проверки укажите тестовый аккаунт **ментора** — вход пока только для менторов.

Тестировщик ставит приложение **TestFlight** из App Store и открывает приглашение.

Следующие сборки — те же две команды; номер сборки растёт сам (`autoIncrement`).

## Проверки

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Устройство

- `src/app/` — экраны (Expo Router). `(app)/` закрыт для невошедших (`Stack.Protected`).
- `src/lib/api.ts` — клиент API: access-токен в памяти, обновление по 401 одним запросом.
- `src/lib/session.tsx` — сессия; приложение пока только для роли Mentor.
- `src/lib/i18n.ts` — переводы: общие строки из `Frontend/src/shared/i18n/catalog`, свои — `src/i18n`.
- `src/constants/theme.ts` — цвета RAVAND, те же, что в `Frontend/src/index.css`.
- `src/features/assignments/` — запросы, статусы и группировка заданий.
