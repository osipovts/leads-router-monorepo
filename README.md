# О проекте

Бэкенд для приема лид-форм и отправки их в различные приемники: PostgreSQL, Telegram, email и другие адаптеры. В
монорепе также лежит минимальный пример фронтенда — `apps/frontend`.

## Архитектура

```
  [ Gateway ] ──► [ BullMQ/Redis ] ──► [ Router ]
                                            │
        ┌────────────┬──────────────┬───────┴──────┐
        ▼            ▼              ▼              ▼
     [ DB ]     [ Telegram ]    [ Email ]       [ HTTP ] ──► [ Gateway: Каскад ]
```

## Каскад

HTTP-адаптер позволяет строить цепочки инстансов: в `HTTP_LEAD_DELIVERY_ENDPOINTS` можно указать один или несколько
эндпоинтов `POST /api/v1/leads` на других серверах-инстансах, организовав таким образом каскад.

Каскад может быть полезен для отправки лидов из РФ в Telegram и другие деградировавшие в стране сервисы: входной узел на
российском сервере принимает лид (там же можно его сохранить в БД-адаптере чтобы он точно не потерялся), затем через
HTTP-адаптер лид отправляется на зарубежный инстанс, и оттуда уходит в Telegram.

## Быстрый запуск

Скопируйте репозиторий

```bash
git clone https://github.com/osipovts/leads-router-monorepo.git
```

Скопируйте `env.example` в `.env` и настройте проект.

```bash
cd leads-router-monorepo
cp .env.example .env # здесь лежат инфраструктурные переменные - креды, порты
cp apps/gateway/.env.example apps/gateway/.env # троттлинг, сваггер, bullmq
cp apps/router/.env.example apps/router/.env # креды адаптеров (tg, pg, email)
```

Запустите

```bash
docker compose up --build
```

После запуска будут доступны:

1. Пример фронтенда на [http://localhost:5173](http://localhost:5173)
2. Swagger UI на [http://localhost:3000](http://localhost:3000). Можно отключить в `app/gateway/.env`
3. Bull Dashboard на [http://localhost:4000](http://localhost:4000)

`docker-compose.yml` содержит лишь самодостаточную демо-конфигурацию: для полноценного production-использования он не
рекомендуется.

# Фронтенд

`apps/frontend` - минимальное React-приложение (Vite + TS): форма отправки лида на `POST /api/v1/leads` с показом
результата. Порт фронтенда настраивается переменной `FRONTEND_FORWARD_PORT` в корневом `.env` (по умолчанию `5173`).

# Тесты

## Unit-тесты

TBD

## E2E-тесты

Запуск e2e-тестов:

```
pnpm test:e2e # в корне монорепы
```
