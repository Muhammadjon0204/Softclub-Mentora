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
