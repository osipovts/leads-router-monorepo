# Router

Каждый адаптер доставки лидов это отдельный NestJS-модуль в
`src/leads-module/infrastructure/delivery/<канал>-lead-delivery/`. Инфраструктурные детали (SDK, драйверы) скрыты в
client-подмодулях (`http-client/`, `telegram-client/`, `database-client/`).

Адаптер регистрируется в реестре `LEAD_DELIVERY_ADAPTERS` только если его флаг `ENABLED=true`. Таким образом можно
включать и выключать адаптеры через конфигурацию в `.env`. Например, следующая настройка выключить telegram-адаптер:

```
TELEGRAM_LEAD_DELIVERY_ENABLED=false
```

## Канал console

Просто выводит лид в консоль. Используется для дебага.

Доступные настройки:

- `CONSOLE_LEAD_DELIVERY_ENABLED`

## Канал database

Сохраняет лиды в PostgreSQL через Prisma.

Доступные настройки:

- `DATABASE_LEAD_DELIVERY_ENABLED`

## Канал telegram

Отправляет лид через телеграм бота в чат.

Доступные настройки:

- `TELEGRAM_LEAD_DELIVERY_ENABLED`
- `TELEGRAM_LEAD_DELIVERY_CHAT_ID`
- `TELEGRAM_CLIENT_TOKEN` — токен бота (настройка клиента)

## Канал http

Рассылает лид по HTTP-эндпоинтам.

Доступные настройки:

- `HTTP_LEAD_DELIVERY_ENABLED`
- `HTTP_LEAD_DELIVERY_ENDPOINTS` — список URL через запятую
- `HTTP_CLIENT_TIMEOUT`, `HTTP_CLIENT_RETRY_COUNT` — настройки клиента
