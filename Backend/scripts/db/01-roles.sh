#!/bin/sh
# Три роли базы с непересекающимися правами (ТЗ 12.6, DEPLOY-008, DEPLOY-009).
#
#   mentortaskflow_app        — приложение. Без DDL. С Phase 1 у него отозваны UPDATE и DELETE
#                               на append-only таблицах (task_events, audit_logs,
#                               user_category_history, user_branch_history).
#   mentortaskflow_migrator   — миграции и bootstrap. Полный DDL.
#   mentortaskflow_retention  — джоба очистки. Только DELETE на таблицах с ограниченным сроком
#                               жизни (ТЗ 27.5), без DDL.
#
# Запускается entrypoint'ом postgres ОДИН раз — при инициализации пустого тома. На уже
# существующей базе файл не выполняется вовсе; менять пароли там нужно вручную (см. DEPLOY.md).
#
# Раньше это был .sql с зашитыми паролями `mentortaskflow_dev`. Так они попадали и в production,
# оставаясь при этом опубликованными в репозитории; теперь пароли приходят из окружения, а
# значение по умолчанию осталось только для локальной разработки (SEC-010).

set -e

APP_DB_PASSWORD="${APP_DB_PASSWORD:-mentortaskflow_dev}"
MIGRATOR_DB_PASSWORD="${MIGRATOR_DB_PASSWORD:-mentortaskflow_dev}"
RETENTION_DB_PASSWORD="${RETENTION_DB_PASSWORD:-mentortaskflow_dev}"

# Дефолт годится только для разработки. Production запускается с ASPNETCORE_ENVIRONMENT=Production
# и обязан передать свои значения — иначе роли получили бы пароль из публичного репозитория, и
# init прошёл бы успешно, оставив дыру, которую никто не заметит.
if [ "${ASPNETCORE_ENVIRONMENT:-}" = "Production" ] && [ "$APP_DB_PASSWORD" = "mentortaskflow_dev" ]; then
    echo "01-roles.sh: APP_DB_PASSWORD/MIGRATOR_DB_PASSWORD/RETENTION_DB_PASSWORD не заданы." >&2
    echo "01-roles.sh: заполните их в .env — см. DEPLOY.md." >&2
    exit 1
fi

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" \
     -v app_password="$APP_DB_PASSWORD" \
     -v migrator_password="$MIGRATOR_DB_PASSWORD" \
     -v retention_password="$RETENTION_DB_PASSWORD" <<'SQL'

CREATE ROLE mentortaskflow_app       WITH LOGIN PASSWORD :'app_password';
CREATE ROLE mentortaskflow_migrator  WITH LOGIN PASSWORD :'migrator_password';
CREATE ROLE mentortaskflow_retention WITH LOGIN PASSWORD :'retention_password';

GRANT CONNECT ON DATABASE mentortaskflow TO
    mentortaskflow_app, mentortaskflow_migrator, mentortaskflow_retention;

-- Мигратор владеет схемой, поэтому может раздавать права на всё, что создаёт.
ALTER SCHEMA public OWNER TO mentortaskflow_migrator;

-- CREATE на базе — это право создавать СХЕМЫ, а не таблицы (для таблиц достаточно прав на
-- схему). Нужно ровно для одной: планировщик держит свои таблицы в отдельной схеме (ADR-002),
-- и создаёт её мигратор, потому что у роли приложения прав на DDL нет вовсе (DEPLOY-017).
-- Владение схемой public этого права не даёт — их проверяют независимо.
GRANT CREATE ON DATABASE mentortaskflow TO mentortaskflow_migrator;

GRANT USAGE ON SCHEMA public TO mentortaskflow_app, mentortaskflow_retention;

-- Права по умолчанию распространяются на таблицы, которые мигратор создаст позже, — чтобы
-- миграциям Phase 1 не приходилось выдавать их заново. Точечный REVOKE для append-only таблиц
-- входит в саму миграцию.
ALTER DEFAULT PRIVILEGES FOR ROLE mentortaskflow_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mentortaskflow_app;

ALTER DEFAULT PRIVILEGES FOR ROLE mentortaskflow_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO mentortaskflow_app;

-- Retention получает SELECT везде; DELETE выдаётся потаблично той миграцией, которая таблицу
-- вводит, и никогда оптом.
ALTER DEFAULT PRIVILEGES FOR ROLE mentortaskflow_migrator IN SCHEMA public
    GRANT SELECT ON TABLES TO mentortaskflow_retention;

SQL

echo "01-roles.sh: роли созданы."
