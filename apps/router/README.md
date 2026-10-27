# Router

Каждый адаптер доставки лидов это отдельный NestJS-модуль в
`src/leads-module/infrastructure/delivery/<канал>-lead-delivery/`. Инфраструктурные детали (SDK, драйверы) скрыты в
client-подмодулях (`http-client/`, `telegram-client/`, `database-client/`, `email-client/`) соответствующего адаптера.

## Канал console

Просто выводит лид в консоль. Используется для дебага: канал пишет полные данные лида
(включая contact и message) в логи, поэтому по умолчанию выключен.

Доступные настройки:

- `CONSOLE_LEAD_DELIVERY_ENABLED` (по умолчанию `false`)

## Канал database

Сохраняет лиды в PostgreSQL через Prisma.

Доступные настройки:

- `DATABASE_LEAD_DELIVERY_ENABLED`
- `DATABASE_URL` - строка подключения (настройка клиента; валидируется только при включённом канале)
- `DATABASE_CONNECTION_TIMEOUT`, `DATABASE_STATEMENT_TIMEOUT` - таймауты соединения и запроса pg-пула в
  миллисекундах (настройки клиента; дефолты 10000 и 15000)

## Канал telegram

Отправляет лид через телеграм бота в чат. На 429 повтор задачи ждёт не меньше `retry_after` из ответа Telegram,
даже если `LEADS_QUEUE_BACKOFF` короче. Router нужно выкатывать раньше gateway: задачи нового gateway
ссылаются на стратегию backoff, которую регистрирует только обновлённый воркер.

Доступные настройки:

- `TELEGRAM_LEAD_DELIVERY_ENABLED`
- `TELEGRAM_LEAD_DELIVERY_CHAT_ID`
- `TELEGRAM_CLIENT_TOKEN` - токен бота (настройка клиента)

## Канал http

Рассылает лид по другим инстансам. Редиректы не отслеживаются: ответ 3xx считается
permanent-ошибкой доставки (ретраев не будет), потому что следование редиректу превращает POST в GET без тела.
Клиентские ретраи отключены: единственный слой повторов — attempts задачи BullMQ (`LEADS_QUEUE_ATTEMPTS` в gateway).
В логах и ошибках задач учётные данные и значения query в URL эндпоинта заменяются на `***`.

Если часть эндпоинтов временно недоступна, адаптер сохраняет в задаче тех, кто уже принял лид (`deliveredDestinations`),
и повтор отправляет лид только остальным. Дубль всё же возможен, если воркер упадёт между ответом эндпоинта и
сохранением отметки, поэтому внешний получатель должен отбрасывать повторы по `id` лида; инстансы этого проекта уже
делают это через дедупликацию.

Доступные настройки:

- `HTTP_LEAD_DELIVERY_ENABLED`
- `HTTP_LEAD_DELIVERY_ENDPOINTS` - список URL через запятую
- `HTTP_CLIENT_TIMEOUT` - таймаут запроса клиента (мс)

## Канал email

Отправляет лид письмом через SMTP (nodemailer).

Доступные настройки:

- `EMAIL_LEAD_DELIVERY_ENABLED`
- `EMAIL_LEAD_DELIVERY_TO` - адрес получателя
- `EMAIL_CLIENT_HOST`, `EMAIL_CLIENT_PORT`, `EMAIL_CLIENT_SECURE`, `EMAIL_CLIENT_USER`, `EMAIL_CLIENT_PASSWORD`,
  `EMAIL_CLIENT_FROM` - настройки SMTP-клиента
- `EMAIL_CLIENT_REQUIRE_TLS` - при `EMAIL_CLIENT_SECURE=false` требовать STARTTLS (по умолчанию `true`);
  `false` разрешает передачу пароля и лида открытым текстом
- `EMAIL_CLIENT_CONNECTION_TIMEOUT`, `EMAIL_CLIENT_GREETING_TIMEOUT`, `EMAIL_CLIENT_SOCKET_TIMEOUT` - таймауты
  соединения, greeting и бездействия сокета в миллисекундах (дефолты 10000, 10000 и 30000)
