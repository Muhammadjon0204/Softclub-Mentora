# Деплой MentorTaskFlow на сервер

Сервер: Ubuntu (Hetzner), IP `204.168.250.48`.

## 1. Подготовка сервера

```bash
# Установить Docker и Docker Compose (если ещё нет)
sudo apt update && sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER
# Перелогиниться, чтобы группа подхватилась
```

## 2. Клонировать репозиторий

```bash
sudo mkdir -p /var/www/academy-projects/mentora
cd /var/www/academy-projects/mentora
git clone <URL_РЕПОЗИТОРИЯ> .
```

## 3. Настроить .env

```bash
cp .env.example .env
nano .env
```

Обязательно заполнить:

| Переменная | Что вписать |
|---|---|
| `POSTGRES_PASSWORD` | Сгенерировать: `openssl rand -base64 32` |
| `CONNECTION_STRING_APP` | Вписать пароль для `mentortaskflow_app` |
| `CONNECTION_STRING_MIGRATOR` | Вписать пароль для `mentortaskflow_migrator` |
| `MINIO_ROOT_USER` | Логин MinIO: `openssl rand -hex 16` |
| `MINIO_ROOT_PASSWORD` | Пароль MinIO: `openssl rand -base64 32` |
| `AUTH_JWT_SIGNING_KEY` | `openssl rand -base64 48` |
| `CORS_ALLOWED_ORIGIN` | `http://204.168.250.48` (или домен) |
| `BOOTSTRAP_ADMIN_EMAIL` | Email первого администратора |

## 4. Запуск

```bash
cd /var/www/academy-projects/mentora

# Собрать и запустить все контейнеры
docker compose -f docker-compose.prod.yml up -d --build

# Проверить что всё поднялось
docker compose -f docker-compose.prod.yml ps

# Посмотреть логи мигратора (там будет ссылка для установки пароля)
docker compose -f docker-compose.prod.yml logs mtf-migrator

# Логи API
docker compose -f docker-compose.prod.yml logs -f mtf-api
```

## 5. Проверка

```bash
# Health check бэкенда
curl http://localhost:8080/health/live

# Открыть в браузере
# http://204.168.250.48
```

## 6. Обновление (при новых коммитах)

```bash
cd /var/www/academy-projects/mentora
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Архитектура контейнеров

```
Браузер → :80 (mtf-web / nginx)
              ├── /api/*  → mtf-api:8080 (.NET API)
              └── /*      → index.html (React SPA)

mtf-worker   — фоновые задачи (Hangfire, email, Telegram)
mtf-migrator — миграции БД (запускается один раз, потом exit)
postgres     — база данных
minio        — хранилище файлов (S3-compatible)
```

## Если нужен домен и HTTPS

Вариант 1 — Nginx + Certbot на хосте:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Создать конфиг /etc/nginx/sites-available/mentora
```

```nginx
server {
    server_name mentora.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mentora /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d mentora.yourdomain.com
```

Потом обновить в `.env`:
```
CORS_ALLOWED_ORIGIN=https://mentora.yourdomain.com
WEB_PORT=3000   # чтобы не конфликтовать с хостовым nginx на 80
```

И перезапустить: `docker compose -f docker-compose.prod.yml up -d`
