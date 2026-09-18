# Деплой MentorTaskFlow

Сервер: Ubuntu (Hetzner), `204.168.250.48`, каталог `/var/www/academy-projects/mentora`.

Схема как в остальных проектах на этой машине: контейнеры слушают порт на `127.0.0.1`,
домены и HTTPS настраиваются отдельно хостовым nginx.

```
пользователи ─▶ https://tms.softclub.tj          ─▶ 127.0.0.1:8092   mentora-web
        SPA  ─▶ https://tmsapi.softclub.tj      ─▶ 127.0.0.1:8093   mentora-api
     браузер ─▶ https://tmsstorage.softclub.tj  ─▶ 127.0.0.1:9092   mentora-minio

                          внутренняя сеть, наружу не публикуются:
                          mentora-db, mentora-worker, mentora-migrator
```

Два независимых compose-проекта, у каждого свой файл настроек:

| Compose | `.env` | Сервисы | Проект |
|---|---|---|---|
| `docker-compose.api.yml` | `.env.api` | `mentora-db` `mentora-minio` `mentora-migrator` `mentora-api` `mentora-worker` | `mentora` |
| `docker-compose.web.yml` | `.env.web` | `mentora-web` | `mentora-web` |

Общей сети им не нужно: маршрутизацию между `tms.softclub.tj` и `tmsapi.softclub.tj` делает хостовый
nginx, контейнеры друг о друге не знают и деплоятся независимо. Правка или удаление
строки в одном `.env` не может сломать другую половину.

Имя файла нестандартное, поэтому его надо передавать явно — Compose сам подхватывает
только `.env`:

```bash
docker compose --env-file .env.api  -f docker-compose.api.yml  <команда>
docker compose --env-file .env.web  -f docker-compose.web.yml  <команда>
```

Единственное, что связывает два файла, — адреса. `VITE_API_BASE_URL` в `.env.web`
должен указывать на `tmsapi.softclub.tj`, а `Cors__AllowedOrigins__0` в `.env.api` — на
адрес фронта. Расхождение выглядит как «запросы из браузера не уходят, в консоли CORS».

Порты `8092`, `8093`, `9092` свободны — остальные проекты машины занимают
`2358 3001-3004 3010 3011 5000 5401-5403 5407 5409 5459 6380 8001-8003 8007 8082 8085 8347 8348 8999`.

---

## Важно про адреса

Фронт и API обязаны быть **в одной зоне**: либо оба на поддоменах одного корня, либо
оба на одном IP. Смешивать нельзя по двум независимым причинам:

- куки `mtf_rt` и `mtf_csrf` выставлены host-only и с `SameSite=Strict` — между доменом
  и IP они не передаются, и первый же refresh выкинет пользователя;
- страница по `https` не может обращаться к `http`-адресу — браузер блокирует запрос.

`https://tms.softclub.tj` + `https://tmsapi.softclub.tj` — рабочая пара. `https://tms.softclub.tj` +
`http://IP:8093` — нет.

---

## 1. Снять предыдущий запуск

На сервере крутится стек под именем проекта `mentortaskflow-prod`: `mtf-worker` в
бесконечном перезапуске, `mtf-web` не собран, порты наружу не проброшены. Имена
сервисов и томов у нового другие, поэтому он не обновляется — его надо убрать.

Если из старой базы что-то нужно, сначала снимите дамп:

```bash
cd /var/www/academy-projects/mentora
docker exec mentortaskflow-prod-postgres-1 \
  pg_dump -U postgres mentortaskflow > ~/mentortaskflow-backup-$(date +%F).sql
```

Затем — **до** `git pull`, пока на диске лежит старый compose-файл:

```bash
docker compose -f docker-compose.prod.yml down -v
```

`-v` удаляет тома вместе с контейнерами: и базу, и файлы MinIO. Так и задумано —
новый стек поднимается с чистого листа, роли БД получают ваши пароли, а bootstrap
заново выдаёт ссылку на пароль администратора.

---

## 2. Обновить код и заполнить `.env`

```bash
git pull
nano .env.api
```

`.env.api` и `.env.web` лежат в репозитории, поэтому заполненные на сервере значения
`git pull` затрёт или упрётся в конфликт. Один раз выполните на сервере:

```bash
git update-index --skip-worktree .env.api .env.web
```

После этого git перестанет замечать локальные правки этих двух файлов и `git pull`
будет их обходить. Чтобы позже подтянуть новые переменные из репозитория:

```bash
git update-index --no-skip-worktree .env.api .env.web
git pull
# перенести свои значения в обновлённый файл
git update-index --skip-worktree .env.api .env.web
```

### `.env.api`

Пароли уже сгенерированы и лежат в файле — `POSTGRES_PASSWORD`, три пароля ролей БД,
`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` и `Auth__JwtSigningKey`. Каждый записан **один
раз**: строки подключения и ключи доступа к MinIO `docker-compose.api.yml` собирает из
них сам.

Осталось заполнить руками:

| Переменная | Чем | Обязательна |
|---|---|---|
| `Bootstrap__AdminEmail` | почта первого администратора | **да** |
| `Notifications__SmtpHost` и остальные `Smtp*` | учётка почтового провайдера | для писем |
| `Telegram__BotToken` | выдаёт @BotFather | только при `Telegram__Enabled=true` |
| `Ai__ApiKey` | ключ Anthropic | только при `Ai__Enabled=true` |

Без `Bootstrap__AdminEmail` мигратор пропустит создание первой организации и напишет об
этом в лог — упасть не упадёт, но и учётной записи, под которой войти, не появится.

Если будете менять пароли: не используйте `;` и `#` — первый ломает строку подключения
Npgsql, второй начинает комментарий в `.env`. Сгенерированные значения в hex таких
символов не содержат.

Домены уже проставлены, менять не нужно — четыре строки для справки:

```
Auth__AppBaseUrl=https://tms.softclub.tj
Notifications__AppBaseUrl=https://tms.softclub.tj
Cors__AllowedOrigins__0=https://tms.softclub.tj
Storage__PublicEndpoint=https://tmsstorage.softclub.tj
```

`Cors__AllowedOrigins__0` должен совпадать с адресом фронта **точно** — схема, хост, без
слеша на конце. Этот же список проверяет заголовок `Origin` у `/auth/refresh`, поэтому
опечатка ломает и вход, и продление сессии.

### `.env.web`

Одна содержательная строка, уже заполнена:

```
VITE_API_BASE_URL=https://tmsapi.softclub.tj
```

Она обязана указывать на тот же адрес, который в разделе 5 отдан tmsapi.softclub.tj.
Значение вшивается в JavaScript **при сборке образа**, поэтому его изменение требует
пересборки, а не перезапуска контейнера.

---

## 3. Запуск бэкенда

```bash
docker compose --env-file .env.api -f docker-compose.api.yml up -d --build mentora-api mentora-worker
```

`mentora-db`, `mentora-minio` и `mentora-migrator` подтянутся сами как зависимости.
Порядок соблюдается автоматически: база становится healthy → мигратор применяет
миграции и выходит → стартуют API и worker.

---

## 4. Проверка

```bash
docker compose --env-file .env.api -f docker-compose.api.yml ps
```

Ожидается: `mentora-db` и `mentora-minio` — `healthy`, `mentora-api` — `healthy`,
`mentora-worker` — `Up` (у него нет healthcheck: он не обслуживает HTTP),
`mentora-migrator` — `Exited (0)`.

```bash
curl http://127.0.0.1:8093/health/live     # процесс жив
curl http://127.0.0.1:8093/health/ready    # база, хранилище, AI
```

`/health/ready` показывает `ai` как `Degraded` — это норма, AI-сводки выключены
(`Ai__Enabled=false`) и на работоспособность не влияют.

**Ссылка на установку пароля администратора** печатается в лог мигратора и больше
нигде не появляется:

```bash
docker compose --env-file .env.api -f docker-compose.api.yml logs mentora-migrator | grep -i password
```

---

## 5. nginx на хосте

```nginx
server {
    server_name tms.softclub.tj;                      # пользователи заходят сюда
    location / {
        proxy_pass         http://127.0.0.1:8092;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    server_name tmsapi.softclub.tj;                  # сюда SPA шлёт запросы

    # Загрузка файлов ограничена приложением 50 MB. Дефолт nginx — 1 MB,
    # и лимит срабатывает на каждом слое, где его не подняли.
    client_max_body_size 50m;

    location / {
        proxy_pass         http://127.0.0.1:8093;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}

server {
    server_name tmsstorage.softclub.tj;              # presigned-ссылки на файлы
    client_max_body_size 50m;

    location / {
        proxy_pass       http://127.0.0.1:9092;
        # Host сохраняется как есть: MinIO подписывает его, и подменённый
        # заголовок ломает проверку подписи.
        proxy_set_header Host $host;
    }
}
```

```bash
sudo certbot --nginx -d tms.softclub.tj -d tmsapi.softclub.tj -d tmsstorage.softclub.tj
```

Все три поддомена обязаны быть под одним корнем — иначе `SameSite=Strict` разведёт
фронт и API по разным сайтам и куки перестанут ходить.

---

## 6. Фронт

Ставится отдельно и от бэкенда не зависит:

```bash
docker compose --env-file .env.web -f docker-compose.web.yml up -d --build
```

`VITE_API_BASE_URL` вшивается в JavaScript **на этапе сборки образа**, а не читается
при запуске. Сменили домен — нужна пересборка (`--build`), перезапуска контейнера с
новым `.env.web` недостаточно.

---

## 7. Обновление

Compose пересоздаёт только те контейнеры, у которых изменился образ:

```bash
git pull

# только API и worker
docker compose --env-file .env.api -f docker-compose.api.yml up -d --build --no-deps mentora-api mentora-worker

# только фронт — бэкенд не затрагивается вообще
docker compose --env-file .env.web -f docker-compose.web.yml up -d --build

# применить новые миграции
docker compose --env-file .env.api -f docker-compose.api.yml up -d --build mentora-migrator
```

### Сборка на сервере или в CI

Команды выше собирают образы прямо на VPS. `dotnet publish` из SDK-образа плюс `npm ci`
занимают больше двух гигабайт памяти на машине, которая обслуживает ещё полтора десятка
контейнеров.

`.github/workflows/deploy.yml` собирает образы в GitHub Actions, публикует в Docker Hub,
а на сервере делает только `pull` + `up -d`. Он не активируется, пока в
Settings → Variables не появится `DEPLOY_ENABLED=true`. Нужны:

- переменные: `DEPLOY_ENABLED`, `VITE_API_BASE_URL`
- секреты: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `SERVER_IP_ADDRESS`,
  `SERVER_USERNAME`, `SSH_KEY`, `SERVER_SSH_PORT`, `SERVER_PROJECT_FOLDER`

---

## 8. Логи

```bash
docker compose --env-file .env.api -f docker-compose.api.yml logs -f mentora-api
docker compose --env-file .env.api -f docker-compose.api.yml logs -f mentora-worker
docker compose --env-file .env.api -f docker-compose.api.yml logs mentora-migrator
docker compose --env-file .env.web -f docker-compose.web.yml logs mentora-web
```

Логи пишутся в JSON (Serilog). Ротации нет — на долгоживущем сервере стоит добавить
`logging.options.max-size` в compose или настроить `/etc/docker/daemon.json`.

---

## Смена паролей на уже существующей базе

`scripts/db/01-roles.sh` выполняется только при инициализации пустого тома. Если база
уже есть, пароли меняются вручную и должны совпасть с `.env.api`:

```bash
docker exec -it mentora-db psql -U postgres -d mentortaskflow -c \
  "ALTER ROLE mentortaskflow_app       WITH PASSWORD 'значение APP_DB_PASSWORD';
   ALTER ROLE mentortaskflow_migrator  WITH PASSWORD 'значение MIGRATOR_DB_PASSWORD';
   ALTER ROLE mentortaskflow_retention WITH PASSWORD 'значение RETENTION_DB_PASSWORD';"
```

---

## Если что-то не поднялось

**`mentora-worker` в `Restarting`** — почти всегда незаполненная настройка: контейнер
падает на старте, а не работает вполсилы, это осознанное поведение (DEPLOY-015). Точную
причину показывает первая строка исключения:

```bash
docker compose --env-file .env.api -f docker-compose.api.yml logs mentora-worker | head -30
```

**`mentora-migrator` вышел с ненулевым кодом** — API и worker не стартуют вовсе, они
ждут его успешного завершения. Обычно это неверный `MIGRATOR_DB_PASSWORD` или
недоступная база.

**Запросы из браузера не уходят, в консоли CORS** — `Cors__AllowedOrigins__0` не совпал
с адресом фронта. Сверьте посимвольно, включая схему и отсутствие слеша на конце.

**Вход проходит, но через 15 минут выкидывает** — не сохранилась кука. Проверьте, что
сайт открыт по `https` и `Auth__RequireSecureCookies=true`; по `http` эта комбинация не
работает.

**Файл не загружается, обрывается на большом размере** — `client_max_body_size` у
хостового nginx. Приложение разрешает 50 MB, дефолт nginx — 1 MB.

**Ссылки на скачивание не открываются** — `Storage__PublicEndpoint` указывает на адрес,
недостижимый из браузера, или nginx перед MinIO подменяет заголовок `Host`.
