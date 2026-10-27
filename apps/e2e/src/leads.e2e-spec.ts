import { execFileSync } from 'node:child_process';
import type { Server as HttpServer } from 'node:http';
import { createServer } from 'node:net';
import { join } from 'node:path';

import {
  ChannelEnum,
  generateLeadId,
  LeadEntity,
  LeadEntityValidation,
  QUEUES,
  type SendLeadJob,
} from '@leads-router/common';
import { getQueueToken } from '@nestjs/bullmq';
// e2e, gateway и router должны разделять один экземпляр Nest: две копии в одном процессе
// сломали бы DI-контейнеры и instanceof-проверки, а подмена Logger.prototype не перехватила бы
// логи приложений. pnpm схлопывает их при одинаковых версиях и peer-зависимостях — это проверяет
// тест 'shares one Nest instance with gateway and router'
import { type INestApplication, Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Job, Queue } from 'bullmq';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

import { AppModule as GatewayAppModule } from '../../gateway/src/app.module';
import { HttpExceptionFilter } from '../../gateway/src/common/presentation/http/http-exception.filter';
import { HttpLoggingInterceptor } from '../../gateway/src/common/presentation/http/http-logging.interceptor';
import { HttpValidationPipe } from '../../gateway/src/common/presentation/http/http-validation.pipe';
import { BullmqQueueService } from '../../gateway/src/leads-module/infrastructure/queue/bullmq-queue.service';
import { leadsQueueConfig, type LeadsQueueConfigType } from '../../gateway/src/leads-module/leads.config';
import { AppModule as RouterAppModule } from '../../router/src/app.module';
import { PrismaService } from '../../router/src/common/infrastructure/prisma/prisma.service';
import { SendLeadUseCase } from '../../router/src/leads-module/application/use-cases/send-lead.use-case';
import { DatabaseClient } from '../../router/src/leads-module/infrastructure/delivery/database-lead-delivery/database-client/database.client';
import { EmailClient } from '../../router/src/leads-module/infrastructure/delivery/email-lead-delivery/email-client/email.client';
import {
  emailClientConfig,
  type EmailClientConfigType,
} from '../../router/src/leads-module/infrastructure/delivery/email-lead-delivery/email-client/email-client.config';
import {
  httpLeadDeliveryConfig,
  type HttpLeadDeliveryConfigType,
} from '../../router/src/leads-module/infrastructure/delivery/http-lead-delivery/http-lead-delivery.config';
import { TelegramLeadDeliveryAdapter } from '../../router/src/leads-module/infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.adapter';
import { LeadsProcessor } from '../../router/src/leads-module/presentation/queue/leads.processor';
import { type HttpSink, startHttpSink } from './support/http-sink';
import { type SmtpSink, startSmtpSink } from './support/smtp-sink';
import { startTelegramApiSink, type TelegramApiCall, type TelegramApiSink } from './support/telegram-api-sink';
import { waitFor } from './support/wait-for';

jest.setTimeout(240_000);

// afterAll вызывается даже при упавшем beforeAll, поэтому доступ к неинициализированным
// ресурсам защищён обработкой ошибок, чтобы сбой очистки не мешал закрыть остальные.
const silently = async (action: () => unknown): Promise<void> => {
  try {
    await action();
  } catch {
    // ресурс не был создан (beforeAll оборвался раньше) или уже закрыт
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

/** Занимает свободный ephemeral-порт и возвращает его номер, освободив слушатель. */
const reserveHostPort = (): Promise<number> =>
  new Promise((resolve, reject): void => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', (): void => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Port probe has no TCP address'));
        return;
      }
      const { port } = address;
      probe.close((): void => {
        resolve(port);
      });
    });
  });

describe('Lead broadcast full path: gateway -> BullMQ -> router -> delivery adapters', () => {
  // Переменные присваиваются в beforeAll: jest не выполняет тесты,
  // если beforeAll упал, поэтому в самих тестах они гарантированно заполнены
  let postgres!: StartedTestContainer;
  let redis!: StartedTestContainer;
  let http!: HttpSink;
  let gatewayApp!: INestApplication<HttpServer>;
  let routerApp!: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  let prisma!: PrismaService;
  let telegramApi!: TelegramApiSink;
  let adapterLog!: jest.SpyInstance;
  let useCaseVerbose!: jest.SpyInstance;

  let leadSeq = 0;
  let smtp!: SmtpSink;
  let leadsQueue!: Queue<SendLeadJob>;

  const queuedChannels = async (id: string): Promise<ChannelEnum[]> => {
    const jobs = await leadsQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    return jobs
      .filter((job): boolean => job.data.lead.id === id)
      .map((job): ChannelEnum => job.data.channel)
      .sort();
  };

  const settledHttpJob = async (id: string): Promise<Job<SendLeadJob>> => {
    return waitFor(
      async (): Promise<Job<SendLeadJob> | undefined> => {
        const jobs = await leadsQueue.getJobs(['completed', 'failed']);
        return jobs.find((entry): boolean => entry.data.lead.id === id && entry.data.channel === ChannelEnum.HTTP);
      },
      10_000,
      'HTTP delivery job settled',
    );
  };

  const waitForQueueIdle = async (): Promise<void> => {
    await waitFor(async (): Promise<boolean> => {
      const counts = await leadsQueue.getJobCounts('waiting', 'active', 'delayed');
      return counts.waiting === 0 && counts.active === 0 && counts.delayed === 0;
    });
  };

  const postLead = async (
    label: string,
  ): Promise<{ lead: { name: string; contact: string; message: string }; response: request.Response }> => {
    leadSeq += 1;

    // Уникальный contact служит маркером теста: gateway отправляет каждый
    // лид во все каналы, поэтому тесты изолируются фильтрацией по contact
    const lead = {
      name: `E2E ${label}`,
      contact: `e2e-${label}-${Date.now().toString()}-${leadSeq.toString()}@test.local`,
      message: `integration test lead (${label})`,
    };

    const response = await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

    return { lead, response };
  };

  beforeAll(async () => {
    // Фиксированный host-порт postgres: тест остановки БД поднимает контейнер заново через
    // docker start, а динамический порт при этом выделяется заново и не совпадает со старым
    const postgresHostPort = await reserveHostPort();

    postgres = await new GenericContainer('postgres:18-alpine')
      .withEnvironment({ POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres', POSTGRES_DB: 'leads' })
      .withExposedPorts({ container: 5432, host: postgresHostPort })
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    redis = await new GenericContainer('redis:8-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();

    const databaseUrl = `postgresql://postgres:postgres@${postgres.getHost()}:${postgres.getMappedPort(5432).toString()}/leads?schema=public`;

    execFileSync('pnpm', ['--filter', '@leads-router/router', 'exec', 'prisma', 'migrate', 'deploy'], {
      cwd: join(__dirname, '..', '..', '..'),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    http = await startHttpSink();
    smtp = await startSmtpSink();

    // Оба приложения читают process.env при инициализации конфигов,
    // поэтому переменные выставляются до их создания
    process.env.DATABASE_URL = databaseUrl;
    process.env.BULLMQ_CONNECTION_HOST = redis.getHost();
    process.env.BULLMQ_CONNECTION_PORT = redis.getMappedPort(6379).toString();
    delete process.env.BULLMQ_CONNECTION_PASSWORD;

    process.env.CONSOLE_LEAD_DELIVERY_ENABLED = 'true';
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'true';
    process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'true';
    process.env.TELEGRAM_LEAD_DELIVERY_CHAT_ID = '123456789';
    process.env.TELEGRAM_CLIENT_TOKEN = '123456:test-token';
    process.env.HTTP_LEAD_DELIVERY_ENABLED = 'true';
    process.env.HTTP_LEAD_DELIVERY_ENDPOINTS = `http://127.0.0.1:${http.port.toString()}/leads`;
    process.env.HTTP_CLIENT_TIMEOUT = '2000';
    process.env.LEADS_QUEUE_BACKOFF = '50';
    process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
    process.env.EMAIL_LEAD_DELIVERY_TO = 'inbox@test.local';
    process.env.EMAIL_CLIENT_HOST = '127.0.0.1';
    process.env.EMAIL_CLIENT_PORT = smtp.port.toString();
    process.env.EMAIL_CLIENT_SECURE = 'false';
    // SMTP-заглушка не поддерживает STARTTLS: открытая передача включается явно
    process.env.EMAIL_CLIENT_REQUIRE_TLS = 'false';
    process.env.EMAIL_CLIENT_USER = 'leads@test.local';
    process.env.EMAIL_CLIENT_PASSWORD = 'test-password';
    process.env.EMAIL_CLIENT_FROM = 'leads@test.local';
    // Окно троттлинга в 1 секунду и лимит 20: тест 429 отправляет 21 быстрый запрос подряд,
    // а остальные тесты не набирают 20 запросов внутри одной секунды.
    // THROTTLE_TTL_MS меньше 1000 не проходит zod-контракт gateway
    process.env.THROTTLE_TTL_MS = '1000';
    process.env.THROTTLE_LIMIT = '20';

    // Транспорт node-telegram-bot-api запоминает globalThis.fetch в конструкторе,
    // поэтому перехват устанавливается до создания router-приложения.
    telegramApi = startTelegramApiSink('123456:test-token');

    // Nest Logger захватывает ссылки на console при создании экземпляров,
    // поэтому перехватываются методы prototype класса.
    adapterLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    useCaseVerbose = jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Настройка повторяет gateway main.ts: версия API, префикс и глобальные
    // обработчики регистрируются при запуске, а не в AppModule.
    gatewayApp = await NestFactory.create<INestApplication<HttpServer>>(GatewayAppModule);
    gatewayApp.enableVersioning({ type: VersioningType.URI });
    gatewayApp.setGlobalPrefix('api');
    gatewayApp.useGlobalFilters(new HttpExceptionFilter());
    gatewayApp.useGlobalInterceptors(new HttpLoggingInterceptor());
    gatewayApp.useGlobalPipes(new HttpValidationPipe());
    // Общий сервер остаётся открытым до afterAll, в том числе для параллельных запросов supertest.
    await gatewayApp.listen(0, '127.0.0.1');
    leadsQueue = gatewayApp.get<Queue<SendLeadJob>>(getQueueToken(QUEUES.LEADS.QUEUE_NAME));
    await leadsQueue.waitUntilReady();

    routerApp = await NestFactory.createApplicationContext(RouterAppModule);
    prisma = routerApp.get(PrismaService);
  });

  afterAll(async () => {
    jest.restoreAllMocks();

    // beforeAll мог оборваться на середине: каждый ресурс чистим независимо от остальных
    await silently(() => gatewayApp.close());
    await silently(() => routerApp.close());
    await silently(() => http.close());
    await silently(() => smtp.close());
    await silently(() => {
      telegramApi.restore();
    });
    await silently(() => postgres.stop());
    await silently(() => redis.stop());
  });

  // Gateway tests
  it('shares one Nest instance with gateway and router', (): void => {
    for (const app of ['gateway', 'router']) {
      for (const pkg of ['@nestjs/common', '@nestjs/core']) {
        expect(require.resolve(pkg, { paths: [join(__dirname, '..', '..', app)] })).toBe(require.resolve(pkg));
      }
    }
  });

  describe('gateway', () => {
    it('logs the final HTTP status after validation and error mapping', async (): Promise<void> => {
      const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation((): void => undefined);
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(400);
        expect(debug).toHaveBeenCalledWith(expect.stringContaining('status=400'));
      } finally {
        debug.mockRestore();
      }
    });

    it('documents the successful response in the generated OpenAPI', (): void => {
      const document = SwaggerModule.createDocument(gatewayApp, new DocumentBuilder().setVersion('1.0').build());

      expect(document.paths['/api/v1/leads'].post?.responses['201']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/SuccessHttpResponseDto' },
                { properties: { data: { $ref: '#/components/schemas/LeadResponseDto' } } },
              ],
            },
          },
        },
      });
      expect(document.components?.schemas?.LeadResponseDto).toMatchObject({
        required: ['id', 'name', 'contact', 'message'],
      });
    });

    it('accepts a valid lead, generates its id and responds with echoed data', async () => {
      const { lead, response } = await postLead('gateway-valid');

      expect(response.body).toMatchObject({ success: true, data: lead });
      expect((response.body as { data: { id: string } }).data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('rejects an invalid lead with a validation error', async () => {
      const response = await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(400);

      const body = response.body as { success: boolean; error: { error: string } };

      expect(body.success).toBe(false);
      expect(body.error.error).toBe('BadRequestException');
    });

    it.each(['😀'.repeat(64), '✈️'.repeat(32)])(
      'accepts and stores a name containing 64 Unicode code points: %s',
      async (name): Promise<void> => {
        const lead = new LeadEntity(generateLeadId(), name, 'unicode@test.local', '😀'.repeat(2048));

        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

        const saved = await waitFor(() => prisma.lead.findUnique({ where: { id: lead.id } }));
        expect(saved).toMatchObject({ name: lead.name, message: lead.message });
      },
    );

    it.each(['😀'.repeat(65), '✈️'.repeat(33)])(
      'rejects a name exceeding 64 Unicode code points: %s',
      async (name): Promise<void> => {
        const lead = { name, contact: 'unicode@test.local', message: 'hello' };

        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(400);
      },
    );

    it('rate limits requests above the throttle window limit', async (): Promise<void> => {
      // Окно очищается от запросов предыдущих тестов и после теста — для следующих
      await sleep(1_100);

      for (let i = 0; i < 20; i += 1) {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(400);
      }

      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(429);

      await sleep(1_100);
    }, 15_000);
  });

  // Console delivery adapter tests
  describe('console adapter', () => {
    it('logs the delivered lead', async () => {
      const { lead } = await postLead('console');

      await waitFor(
        () =>
          adapterLog.mock.calls.some(
            ([message]) => String(message).includes('Incoming lead') && String(message).includes(lead.contact),
          ),
        10_000,
        'console adapter log',
      );
    });
  });

  // Database delivery adapter tests
  describe('database adapter', () => {
    it('ignores a duplicate primary key even when queue deduplication is bypassed', async (): Promise<void> => {
      const client = routerApp.get(DatabaseClient);
      const lead = new LeadEntity(generateLeadId(), 'Database duplicate', 'duplicate@test.local', 'hello');

      await client.saveLead(lead);
      await client.saveLead(lead);

      expect(await prisma.lead.count({ where: { id: lead.id } })).toBe(1);
    });

    it('saves the delivered lead to postgres', async () => {
      const { lead } = await postLead('database');

      const savedRow = await waitFor(
        () => prisma.lead.findFirst({ where: { contact: lead.contact } }),
        10_000,
        'database row saved',
      );

      expect(savedRow).toMatchObject({ name: lead.name, contact: lead.contact, message: lead.message });
    });

    it('fails database jobs while postgres is down and recovers after a restart', async (): Promise<void> => {
      await waitForQueueIdle();
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      // restart() у testcontainers повторно применяет wait-strategy со счетчиком повторений
      // лога, который перезапущенный postgres уже не выдаёт, поэтому контейнер
      // останавливается без удаления и поднимается docker start без ожидания готовности
      const containerName = postgres.getName().replace(/^\//, '');
      // Rootless docker освобождает проброшенный порт с задержкой: немедленный старт
      // после остановки падает с "address already in use", поэтому старт повторяется
      const startContainer = async (): Promise<void> => {
        for (let attempt = 0; ; attempt += 1) {
          try {
            execFileSync('docker', ['start', containerName], { stdio: 'pipe' });
            return;
          } catch (error) {
            if (attempt >= 4) {
              throw error;
            }
            await sleep(500);
          }
        }
      };
      // timeout 1 — быстрая остановка без десятисекундного grace period
      await postgres.stop({ remove: false, timeout: 1 });
      try {
        const lead = new LeadEntity(generateLeadId(), 'DB outage', 'db-outage@test.local', 'hello');
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

        const job = await waitFor(
          async (): Promise<Job<SendLeadJob> | undefined> => {
            const jobs = await leadsQueue.getJobs(['failed']);
            return jobs.find(
              (entry): boolean => entry.data.lead.id === lead.id && entry.data.channel === ChannelEnum.DATABASE,
            );
          },
          20_000,
          'database job failed',
        );

        // Остановка контейнера снимает проброс порта: соединения отклоняются мгновенно,
        // все три попытки исчерпываются быстрее, чем истечёт таймаут соединения пула
        expect(job.attemptsMade).toBe(3);
        expect(job.failedReason).toContain('postgres failed');
      } finally {
        await startContainer();
        errors.mockRestore();
      }

      // Пул Prisma после остановки контейнера держит мёртвые соединения: пересоздаём его
      // и ждём готовности postgres, пережидая отказы, пока контейнер поднимается
      await waitFor(
        async (): Promise<number | false> => {
          try {
            await prisma.$disconnect();
            await prisma.$connect();
            return await prisma.lead.count();
          } catch {
            return false;
          }
        },
        30_000,
        'postgres accepting connections',
      );
      const { lead: recovered } = await postLead('db-recovery');

      await waitFor(
        () => prisma.lead.findFirst({ where: { contact: recovered.contact } }),
        10_000,
        'database row saved after recovery',
      );
    });
  });

  // Http delivery adapter tests
  describe('http adapter', () => {
    it('retries only the failed endpoint and preserves its status in failure events', async (): Promise<void> => {
      await waitForQueueIdle();
      let calls = 0;
      const failing = await startHttpSink({
        respond: (): { status: number } => ({ status: ++calls === 1 ? 503 : 200 }),
      });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP retry', 'http-retry@test.local', 'hello');
      config.endpoints = [...endpoints, `http://127.0.0.1:${failing.port.toString()}/leads`];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('completed');
        expect(job.attemptsMade).toBe(2);
        expect(calls).toBe(2);
        // Исправный endpoint принял лид с первой попытки: повтор задачи его пропускает
        expect(
          http.requests.filter(
            (entry): boolean =>
              typeof entry.body === 'object' && entry.body !== null && 'id' in entry.body && entry.body.id === lead.id,
          ),
        ).toHaveLength(1);
        const expectedReason: unknown = expect.stringContaining('"status":503');
        expect(errors).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'lead_delivery_failed',
            channel: ChannelEnum.HTTP,
            reason: expectedReason,
          }),
        );
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
        await failing.close();
      }
    });

    it('does not retry a permanent HTTP error', async (): Promise<void> => {
      await waitForQueueIdle();
      const failing = await startHttpSink({ respond: (): { status: number } => ({ status: 400 }) });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP rejected', 'http-rejected@test.local', 'hello');
      config.endpoints = [`http://127.0.0.1:${failing.port.toString()}/leads`];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('failed');
        expect(job.attemptsMade).toBe(1);
        expect(failing.requests).toHaveLength(1);
        expect(job.failedReason).toContain('"status":400');
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
        await failing.close();
      }
    });

    it('retries a network error until attempts are exhausted and keeps the code in the reason', async (): Promise<void> => {
      await waitForQueueIdle();
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP network', 'http-network@test.local', 'hello');
      // Порт 9 (discard) закрыт: соединение отклоняется мгновенно
      config.endpoints = ['http://127.0.0.1:9/leads'];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('failed');
        expect(job.attemptsMade).toBe(3);
        expect(job.failedReason).toContain('"code":"ECONNREFUSED"');
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
      }
    });

    it('fails the delivery when the response body exceeds the size cap', async (): Promise<void> => {
      await waitForQueueIdle();
      const oversized = await startHttpSink({
        respond: (): { status: number; body: string } => ({ status: 200, body: 'x'.repeat(70_000) }),
      });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP size', 'http-size@test.local', 'hello');
      config.endpoints = [`http://127.0.0.1:${oversized.port.toString()}/leads`];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('failed');
        // axios прерывает загрузку без ответа: доступен только код ошибки
        expect(job.failedReason).toContain('"code":"ERR_BAD_RESPONSE"');
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
        await oversized.close();
      }
    });

    it('posts the delivered lead to the configured endpoint', async () => {
      const { lead } = await postLead('http');

      const delivery = await waitFor(
        () => http.requests.find((entry) => (entry.body as { contact?: string }).contact === lead.contact),
        10_000,
        'http sink request',
      );

      expect(delivery.url).toBe('/leads');
      // Каскад получает id лида для дедупликации на своей стороне.
      const anyLeadId: unknown = expect.stringMatching(LeadEntityValidation.id.pattern);
      expect(delivery.body).toMatchObject({ ...lead, id: anyLeadId });
    });
  });

  // Telegram delivery adapter tests
  describe('telegram adapter', () => {
    it('sends the lead text to the configured chat', async () => {
      const { lead } = await postLead('telegram');

      const delivery = await waitFor(
        () => telegramApi.calls.find((call) => call.params.text.includes(lead.contact)),
        10_000,
        'telegram api call',
      );

      expect(delivery.url).toBe('https://api.telegram.org/bot123456:test-token/sendMessage');
      expect(delivery.params.chat_id).toBe('123456789');
      expect(delivery.params.text).toBe(`From: ${lead.name} <${lead.contact}>\nMessage: ${lead.message}`);
    });

    it('waits the retry_after requested by a 429 before the next attempt', async (): Promise<void> => {
      await waitForQueueIdle();
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'Telegram flood', 'telegram-flood@test.local', 'hello');
      const ofLead = (call: TelegramApiCall): boolean => call.params.text.includes(lead.contact);
      telegramApi.respond = (call: TelegramApiCall): Response | undefined =>
        ofLead(call) && telegramApi.calls.filter(ofLead).length === 1
          ? Response.json(
              { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } },
              { status: 429 },
            )
          : undefined;
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

        const [first, second] = await waitFor(
          (): TelegramApiCall[] | undefined => {
            const calls = telegramApi.calls.filter(ofLead);
            return calls.length >= 2 ? calls : undefined;
          },
          10_000,
          'telegram retry after 429',
        );

        // LEADS_QUEUE_BACKOFF=50: без учёта retry_after повтор пришёл бы через ~50 мс
        expect(second.at - first.at).toBeGreaterThanOrEqual(1_000);
      } finally {
        telegramApi.respond = undefined;
        errors.mockRestore();
      }
    });
  });

  // Email delivery adapter tests
  describe('email adapter', () => {
    it('sends the lead text to the configured mailbox', async () => {
      const { lead } = await postLead('email');

      const delivery = await waitFor(
        () => smtp.messages.find((message) => message.text.includes(lead.contact)),
        10_000,
        'smtp message',
      );

      expect(delivery.to).toBe('inbox@test.local');
      expect(delivery.from).toBe('leads@test.local');
      expect(delivery.subject).toBe(`New lead from ${lead.name}`);
      // Тело письма при передаче по SMTP может получить \r\n вместо \n,
      // поэтому сравнивается с нормализацией переводов строк
      const expectedText = `From: ${lead.name} <${lead.contact}>\nMessage: ${lead.message}`;

      expect(delivery.text.replace(/\r\n/g, '\n').trim()).toBe(expectedText);
    });

    it('refuses to send credentials and the lead over SMTP without STARTTLS', async (): Promise<void> => {
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const client = new EmailClient({
        ...routerApp.get<EmailClientConfigType>(emailClientConfig.KEY),
        requireTLS: true,
      });
      const before = smtp.messages.length;
      try {
        await expect(client.sendMail('inbox@test.local', 'plaintext', 'secret lead')).rejects.toThrow();
        expect(smtp.messages).toHaveLength(before);
      } finally {
        errors.mockRestore();
      }
    });
  });

  // Idempotency tests
  describe('idempotency', () => {
    it('accepts the same lead again after the deduplication TTL expires', async (): Promise<void> => {
      const config = gatewayApp.get<LeadsQueueConfigType>(leadsQueueConfig.KEY);
      const sender = new BullmqQueueService(leadsQueue, config, { ttlMs: 1_000 });
      const lead = new LeadEntity(generateLeadId(), 'TTL', 'ttl@test.local', 'hello');

      await sender.sendLead(ChannelEnum.CONSOLE, lead);
      await sender.sendLead(ChannelEnum.CONSOLE, lead);
      expect(await queuedChannels(lead.id)).toEqual([ChannelEnum.CONSOLE]);

      await waitFor(
        async (): Promise<boolean> => (await leadsQueue.getDeduplicationJobId(`${lead.id}-console`)) === null,
      );
      await sender.sendLead(ChannelEnum.CONSOLE, lead);
      expect(await queuedChannels(lead.id)).toEqual([ChannelEnum.CONSOLE, ChannelEnum.CONSOLE]);
    });

    it('deduplicates concurrent requests independently for every channel', async (): Promise<void> => {
      const lead = new LeadEntity(generateLeadId(), 'Concurrent', 'concurrent@test.local', 'hello');

      await Promise.all([
        request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201),
        request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201),
      ]);

      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('retries missing channels without duplicating accepted jobs after a partial failure', async (): Promise<void> => {
      const lead = new LeadEntity(generateLeadId(), 'Retry', 'retry@test.local', 'hello');
      const realAdd = leadsQueue.add.bind(leadsQueue);
      const add = jest
        .spyOn(leadsQueue, 'add')
        .mockImplementation((name, data, options): ReturnType<typeof realAdd> => {
          if (data.lead.id === lead.id && data.channel === ChannelEnum.EMAIL) {
            return Promise.reject(new Error('simulated enqueue failure'));
          }
          return realAdd(name, data, options);
        });

      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503);
        expect(await queuedChannels(lead.id)).toEqual(
          Object.values(ChannelEnum)
            .filter((channel): boolean => channel !== ChannelEnum.EMAIL)
            .sort(),
        );
      } finally {
        add.mockRestore();
      }

      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('does not acknowledge either concurrent request when all enqueue operations fail', async (): Promise<void> => {
      const lead = new LeadEntity(generateLeadId(), 'Unavailable', 'unavailable@test.local', 'hello');
      const add = jest.spyOn(leadsQueue, 'add').mockRejectedValue(new Error('simulated Redis outage'));

      try {
        await Promise.all([
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503),
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503),
        ]);
        expect(await queuedChannels(lead.id)).toEqual([]);
      } finally {
        add.mockRestore();
      }

      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('skips broadcast for a duplicate lead posted with the same id', async () => {
      const { lead, response } = await postLead('idempotency');
      const id = (response.body as { data: { id: string } }).data.id;

      await waitFor(
        () => http.requests.find((entry) => (entry.body as { contact?: string }).contact === lead.contact),
        10_000,
        'first delivery',
      );

      // Повтор запроса с тем же id (как ретрай клиента или пересылка каскадом)
      const duplicate = await request(gatewayApp.getHttpServer())
        .post('/api/v1/leads')
        .send({ id, ...lead })
        .expect(201);

      expect((duplicate.body as { data: { id: string } }).data.id).toBe(id);

      // Второй доставки не было: в http-синке по-прежнему ровно один запрос этого лида
      await new Promise((resolve) => {
        setTimeout(resolve, 1_500);
      });
      expect(
        http.requests.filter((entry) => (entry.body as { contact?: string }).contact === lead.contact),
      ).toHaveLength(1);
    });
  });

  // Disabled channel test
  describe('disabled channels', () => {
    it('router skips disabled telegram channel with a verbose log', async () => {
      // Канал включён глобально, поэтому адаптер отключается точечно:
      // тест проверяет пропуск лида в use-case, а не чтение конфига
      const enabled = jest.spyOn(TelegramLeadDeliveryAdapter.prototype, 'enabled', 'get').mockReturnValue(false);

      try {
        // Verbose-лог не содержит идентификатора лида, поэтому тест фиксирует счётчик
        // вызовов до отправки и ждёт его увеличения
        const skipsBefore = useCaseVerbose.mock.calls.length;

        await postLead('telegram-skip');

        await waitFor(() => useCaseVerbose.mock.calls.length > skipsBefore, 10_000, 'telegram skip verbose log');
      } finally {
        enabled.mockRestore();
      }
    });
  });

  // Worker concurrency test
  describe('worker concurrency', (): void => {
    it('processes two slow deliveries in parallel when concurrency is raised', async (): Promise<void> => {
      await waitForQueueIdle();
      const slow = await startHttpSink({ delayMs: 700 });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const processor = routerApp.get(LeadsProcessor);
      processor.worker.concurrency = 2;
      config.endpoints = [`http://127.0.0.1:${slow.port.toString()}/leads`];
      try {
        const first = new LeadEntity(generateLeadId(), 'Concurrency A', 'concurrency-a@test.local', 'hello');
        const second = new LeadEntity(generateLeadId(), 'Concurrency B', 'concurrency-b@test.local', 'hello');

        await Promise.all([
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(first).expect(201),
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(second).expect(201),
        ]);

        await settledHttpJob(first.id);
        await settledHttpJob(second.id);

        // Две медленные доставки обрабатывались одновременно; concurrency=2 не даёт большего числа
        expect(slow.maxConcurrent).toBe(2);
      } finally {
        processor.worker.concurrency = 1;
        config.endpoints = endpoints;
        await slow.close();
      }
    });
  });

  describe('infrastructure failures', (): void => {
    it('returns 503 within the Redis command budget and recovers after Redis resumes', async (): Promise<void> => {
      await waitForQueueIdle();
      const lead = new LeadEntity(generateLeadId(), 'Redis timeout', 'redis-timeout@test.local', 'hello');
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      await redis.exec(['redis-cli', 'CLIENT', 'PAUSE', '8000', 'ALL']);
      try {
        const startedAt = Date.now();
        await request(gatewayApp.getHttpServer())
          .post('/api/v1/leads')
          .send(lead)
          .timeout({ response: 7_000, deadline: 7_500 })
          .expect(503);
        expect(Date.now() - startedAt).toBeLessThan(7_000);
      } finally {
        await redis.exec(['redis-cli', 'PING']);
        errors.mockRestore();
      }
      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });
  });

  describe('shutdown', (): void => {
    it('drains an active database delivery before disconnecting Prisma', async (): Promise<void> => {
      await waitForQueueIdle();
      const lead = new LeadEntity(generateLeadId(), 'Shutdown', 'shutdown@test.local', 'hello');
      const useCase = routerApp.get(SendLeadUseCase);
      const processor = routerApp.get(LeadsProcessor);
      const execute = useCase.execute.bind(useCase);
      const disconnect = prisma.$disconnect.bind(prisma);
      const closeWorker = processor.worker.close.bind(processor.worker);
      const order: string[] = [];
      let release!: () => void;
      let handling = false;
      let draining = false;
      const pending = new Promise<void>((resolve): void => {
        release = resolve;
      });
      const sending = jest
        .spyOn(useCase, 'execute')
        .mockImplementation(async (channel, current, checkpoint): Promise<void> => {
          const target = current.id === lead.id && channel === ChannelEnum.DATABASE;
          if (target) {
            handling = true;
            await pending;
          }
          await execute(channel, current, checkpoint);
          if (target) {
            order.push('saved');
          }
        });
      const disconnecting = jest.spyOn(prisma, '$disconnect').mockImplementation(async (): Promise<void> => {
        order.push('disconnected');
        await disconnect();
      });
      const drainingWorker = jest.spyOn(processor.worker, 'close').mockImplementation(async (force): Promise<void> => {
        draining = true;
        await closeWorker(force);
      });
      let closing: Promise<void> | undefined;
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        await waitFor((): boolean => handling);
        closing = routerApp.close();
        await waitFor((): boolean => draining);
        expect(disconnecting).not.toHaveBeenCalled();
      } finally {
        release();
        await closing;
        sending.mockRestore();
        disconnecting.mockRestore();
        drainingWorker.mockRestore();
      }
      expect(order).toEqual(['saved', 'disconnected']);
    });
  });
});
