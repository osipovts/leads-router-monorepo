import { consoleAdapterSuite } from './suites/console-adapter.suite';
import { databaseAdapterSuite } from './suites/database-adapter.suite';
import { emailAdapterSuite } from './suites/email-adapter.suite';
import { gatewaySuite } from './suites/gateway.suite';
import { httpAdapterSuite } from './suites/http-adapter.suite';
import { idempotencySuite } from './suites/idempotency.suite';
import { infrastructureFailuresSuite } from './suites/infrastructure-failures.suite';
import { routerWorkerSuite } from './suites/router-worker.suite';
import { shutdownSuite } from './suites/shutdown.suite';
import { telegramAdapterSuite } from './suites/telegram-adapter.suite';
import { type Cleanup, type E2eEnvironment, startEnvironment } from './support/environment';

jest.setTimeout(240_000);

// afterAll вызывается даже при упавшем beforeAll, поэтому сбой закрытия одного ресурса
// не должен мешать закрыть остальные.
const silently = async (action: Cleanup): Promise<void> => {
  try {
    await action();
  } catch {
    // ресурс уже закрыт
  }
};

// Одна точка входа jest: контейнеры и приложения поднимаются один раз на весь прогон,
// а группы тестов лежат в suites/ и получают окружение через env()
describe('Lead broadcast full path: gateway -> BullMQ -> router -> delivery adapters', () => {
  const cleanups: Cleanup[] = [];
  let environment: E2eEnvironment | undefined;

  // jest не выполняет тесты, если beforeAll упал, поэтому в тестах окружение всегда поднято
  const env = (): E2eEnvironment => {
    if (environment === undefined) {
      throw new Error('E2E environment is not started');
    }
    return environment;
  };

  beforeAll(async () => {
    environment = await startEnvironment(cleanups);
  });

  afterAll(async () => {
    jest.restoreAllMocks();

    for (const cleanup of cleanups.reverse()) {
      await silently(cleanup);
    }
  });

  gatewaySuite(env);
  consoleAdapterSuite(env);
  databaseAdapterSuite(env);
  httpAdapterSuite(env);
  telegramAdapterSuite(env);
  emailAdapterSuite(env);
  idempotencySuite(env);
  routerWorkerSuite(env);
  infrastructureFailuresSuite(env);
  // Закрывает router: группа идёт последней
  shutdownSuite(env);
});
