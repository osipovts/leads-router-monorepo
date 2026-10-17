# Router

Каждый адаптер доставки лидов это отдельный NestJS-модуль в
`src/leads-module/infrastructure/delivery/<канал>-lead-delivery/`. Инфраструктурные детали (SDK, драйверы) скрыты в
client-подмодулях (`http-client/`, `telegram-client/`, `database-client/`, `email-client/`) соответствующего адаптера.

## Канал console

Просто выводит лид в консоль. Используется для дебага.

Доступные настройки:

- `CONSOLE_LEAD_DELIVERY_ENABLED`

## Канал database

Сохраняет лиды в PostgreSQL через Prisma.

Доступные настройки:

- `DATABASE_LEAD_DELIVERY_ENABLED`
- `DATABASE_URL` - строка подключения (настройка клиента; валидируется только при включённом канале)

## Канал telegram

Отправляет лид через телеграм бота в чат.

Доступные настройки:

- `TELEGRAM_LEAD_DELIVERY_ENABLED`
- `TELEGRAM_LEAD_DELIVERY_CHAT_ID`
- `TELEGRAM_CLIENT_TOKEN` - токен бота (настройка клиента)

## Канал http

Рассылает лид по другим инстансам.

Доступные настройки:

- `HTTP_LEAD_DELIVERY_ENABLED`
- `HTTP_LEAD_DELIVERY_ENDPOINTS` - список URL через запятую
- `HTTP_CLIENT_TIMEOUT`, `HTTP_CLIENT_RETRY_COUNT` - настройки клиента

## Канал email

Отправляет лид письмом через SMTP (nodemailer).

Доступные настройки:

- `EMAIL_LEAD_DELIVERY_ENABLED`
- `EMAIL_LEAD_DELIVERY_TO` - адрес получателя
- `EMAIL_CLIENT_HOST`, `EMAIL_CLIENT_PORT`, `EMAIL_CLIENT_SECURE`, `EMAIL_CLIENT_USER`, `EMAIL_CLIENT_PASSWORD`,
  `EMAIL_CLIENT_FROM` - настройки SMTP-клиента
