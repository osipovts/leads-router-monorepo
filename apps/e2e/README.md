# E2E

Интеграционные тесты полного пути лида: HTTP-запрос в gateway => валидация => BullMQ (redis) => обработка в router =>
доставка delivery-адаптерами => контроль доставки

## Запуск

```bash
pnpm test:e2e # из корня монорепы
```

Требуется запущенный Docker (testcontainers поднимает postgres и redis сам, на случайных портах, и удаляет их после
прогона).

## Как это работает

- **Инфраструктура**: testcontainers стартует реальные `postgres:18-alpine` и `redis:8-alpine`; према-миграции
  применяются `prisma migrate deploy` к тестовой базе.
- **Приложения in-process**: gateway бутстрапится как HTTP-приложение (без listen, запросы идут через supertest по
  `app.getHttpServer()`), router — как application context. BullMQ связывает их через тестовый redis ровно как в
  продакшене.
- **Контроль доставки**:
  - database — реальная запись, проверяется запросом через `PrismaService`;
  - http — `HTTP_LEAD_DELIVERY_ENDPOINTS` указывает на локальный sink-сервер, который записывает всё присланное;
  - console — шпион за `Logger.prototype` из дерева router;
  - telegram — выключен через `TELEGRAM_LEAD_DELIVERY_ENABLED=false`, проверяется warn о пропуске выключенного канала.
- **Асинхронность**: результаты обработки джобов поллятся (`waitFor`).
- **Структура тестов**: тяжёлый setup (контейнеры, миграции, приложения) один в `beforeAll`;
  дальше отдельные группы — gateway, каждый адаптер, выключенные каналы. Каждый тест шлёт
  свой лид с уникальным `contact` и фильтрует эффекты по нему: gateway фан-аутит каждый лид
  во все каналы, и без маркера тесты мешали бы друг другу.

## Технические детали

- `NODE_OPTIONS=--experimental-vm-modules` — Nest 12 поставляется как ESM, а jest требует этот флаг для `require(esm)` в
  CJS-рантайме тестов.
- Импорты `@nestjs/core`/`@nestjs/common` из дерева gateway/router гарантируют единственные экземпляры этих пакетов в
  процессе: две копии Nest сломали бы DI и instanceof-проверки.
