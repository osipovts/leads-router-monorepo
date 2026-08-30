# О проекте

Бэкенд для приема лид-форм и отправки их в различные приемники: telegram, e-mail, webhook, slack, и т.д.

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
                         │      Forwarder      │
                         │                     │
                         │ Job processing      │
                         │ Idempotency         │
                         └──────────┬──────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
                   ▼                ▼                ▼
             ┌──────────┐     ┌──────────┐    ┌──────────┐
             │ Telegram │     │  Email   │    │   ...    │
             │ Adapter  │     │ Adapter  │    │ Adapter  │
             └──────────┘     └──────────┘    └──────────┘
```

## Запуск

Скопируйте репозиторий

```bash
git clone https://github.com/osipovts/leads-router-monorepo.git
```

Скопируйте `env.example` в `.env`. Базовые `.env.example` уже содержат хорошие значения по умолчанию, но при
необходимости отредактируйте .env

```bash
cd leads-router-monorepo
cp .env.example .env # здесь лежат инфраструктурные переменные
cp apps/gateway/.env.example apps/gateway/.env
cp apps/router/.env.example apps/router/.env
```

Перед запуском замените `REDIS_PASSWORD` в корневом `.env` на длинный случайный пароль.

Запустите

```bash
docker compose up
```

После запуска будут доступны:

1. Swagger UI на [http://localhost:3000](http://localhost:4000)
2. Bull Dashboard на [http://localhost:4000](http://localhost:4000)
