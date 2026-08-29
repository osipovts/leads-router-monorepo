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

```bash
pnpm start:dev # запуск всех сервисов сразу
# или:
pnpm --filter gateway start:dev # запуск gateway
pnpm --filter router start:dev # запуск router
```
