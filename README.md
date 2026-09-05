# О проекте

Бэкенд для приема лид-форм и отправки их в различные приемники: PostgreSQL, Telegram, console и другие адаптеры.

## Архитектура

```text
                         ┌─────────────────────┐
                         │       Gateway       │
                         │                     │
                         │ Validation          │
                         │ Rate limiting       │
                         └──────────┬──────────┘
                                    │
                                    │ enqueue
                                    ▼
                         ┌─────────────────────┐
                         │        Redis        │
                         │       BullMQ        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Router        │
                         │                     │
                         │ Job processing      │
                         │ Idempotency         │
                         └──────────┬──────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
                   ▼                ▼                ▼
             ┌──────────┐     ┌──────────┐    ┌──────────┐
             │ Telegram │     │PostgreSQL│    │   ...    │
             │ Adapter  │     │ Adapter  │    │ Adapter  │
             └──────────┘     └──────────┘    └──────────┘
```

## Быстрый запуск

Скопируйте репозиторий

```bash
git clone https://github.com/osipovts/leads-router-monorepo.git
```

Скопируйте `env.example` в `.env`. Базовые `.env.example` уже содержат хорошие значения по умолчанию, но при
необходимости отредактируйте `.env`.

Для отправки лидов в Telegram задайте токен telegram-бота и ID целевого чата в `apps/router/.env`.

```bash
cd leads-router-monorepo
cp .env.example .env # здесь лежат инфраструктурные переменные
cp apps/gateway/.env.example apps/gateway/.env
cp apps/router/.env.example apps/router/.env
```

Перед запуском замените `REDIS_PASSWORD` и `POSTGRES_PASSWORD` в корневом `.env` на длинные случайные пароли. Пароль
PostgreSQL в `apps/router/.env` должен совпадать со значением `POSTGRES_PASSWORD`.

Запустите

```bash
docker compose up
```

После запуска будут доступны:

1. Swagger UI на [http://localhost:3000](http://localhost:3000)
2. Bull Dashboard на [http://localhost:4000](http://localhost:4000)

`docker-compose.yml` содержит самодостаточную демо-конфигурацию: для полноценного production-использования он не
рекомендуется.
