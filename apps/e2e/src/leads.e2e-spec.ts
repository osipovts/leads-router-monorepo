import { execFileSync } from 'node:child_process';
import type { Server as HttpServer } from 'node:http';
import { join } from 'node:path';

import { ChannelEnum, LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

import { type INestApplication, VersioningType } from '../../gateway/node_modules/@nestjs/common';
// Импорт из дерева gateway гарантирует тот же самый экземпляр @nestjs/core,
// который создаёт приложение: две копии Nest в одном процессе
// сломали бы DI-контейнеры и instanceof-проверки
import { NestFactory } from '../../gateway/node_modules/@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '../../gateway/node_modules/@nestjs/swagger';
import { AppModule as GatewayAppModule } from '../../gateway/src/app.module';
import { HttpExceptionFilter } from '../../gateway/src/common/presentation/http/http-exception.filter';
import { HttpLoggingInterceptor } from '../../gateway/src/common/presentation/http/http-logging.interceptor';
import { HttpValidationPipe } from '../../gateway/src/common/presentation/http/http-validation.pipe';
// Logger из дерева router это тот же класс, экземпляры которого используют
// адаптеры доставки: подмена методов prototype перехватывает их вызовы.
import { Logger as RouterLogger } from '../../router/node_modules/@nestjs/common';
import { AppModule as RouterAppModule } from '../../router/src/app.module';
import { PrismaService } from '../../router/src/common/infrastructure/prisma/prisma.service';
import { TelegramLeadDeliveryAdapter } from '../../router/src/leads-module/infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.adapter';
import { type HttpSink, startHttpSink } from './support/http-sink';
import { type SmtpSink, startSmtpSink } from './support/smtp-sink';
import { startTelegramApiSink, type TelegramApiSink } from './support/telegram-api-sink';
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

    const response = await request(gatewayApp.getHttpServer())
      .post('/api/v1/leads')
      .send(lead)
      .expect(201);

    return { lead, response };
  };

  beforeAll(async () => {
    postgres = await new GenericContainer('postgres:18-alpine')
      .withEnvironment({ POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres', POSTGRES_DB: 'leads' })
      .withExposedPorts(5432)
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
    process.env.HTTP_CLIENT_RETRY_COUNT = '1';
    process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
    process.env.EMAIL_LEAD_DELIVERY_TO = 'inbox@test.local';
    process.env.EMAIL_CLIENT_HOST = '127.0.0.1';
    process.env.EMAIL_CLIENT_PORT = smtp.port.toString();
    process.env.EMAIL_CLIENT_SECURE = 'false';
    process.env.EMAIL_CLIENT_USER = 'leads@test.local';
    process.env.EMAIL_CLIENT_PASSWORD = 'test-password';
    process.env.EMAIL_CLIENT_FROM = 'leads@test.local';

    // Транспорт node-telegram-bot-api запоминает globalThis.fetch в конструкторе,
    // поэтому перехват устанавливается до создания router-приложения.
    telegramApi = startTelegramApiSink('123456:test-token');

    // Nest Logger захватывает ссылки на console при создании экземпляров,
    // поэтому перехватываются методы prototype класса из дерева router.
    adapterLog = jest.spyOn(RouterLogger.prototype, 'log').mockImplementation(() => undefined);
    useCaseVerbose = jest.spyOn(RouterLogger.prototype, 'verbose').mockImplementation(() => undefined);
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
  describe('gateway', () => {
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
      const response = await request(gatewayApp.getHttpServer())
        .post('/api/v1/leads')
        .send({ name: '' })
        .expect(400);

      const body = response.body as { success: boolean; error: { error: string } };

      expect(body.success).toBe(false);
      expect(body.error.error).toBe('BadRequestException');
    });

    it.each(['😀'.repeat(64), '✈️'.repeat(32)])(
      'accepts and stores a name containing 64 Unicode code points: %s',
      async (name): Promise<void> => {
        const lead = LeadEntity.generate(name, 'unicode@test.local', '😀'.repeat(2048));

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
    it('saves the delivered lead to postgres', async () => {
      const { lead } = await postLead('database');

      const savedRow = await waitFor(
        () => prisma.lead.findFirst({ where: { contact: lead.contact } }),
        10_000,
        'database row saved',
      );

      expect(savedRow).toMatchObject({ name: lead.name, contact: lead.contact, message: lead.message });
    });
  });

  // Http delivery adapter tests
  describe('http adapter', () => {
    it('posts the delivered lead to the configured endpoint', async () => {
      const { lead } = await postLead('http');

      const delivery = await waitFor(
        () => http.requests.find((entry) => (entry.body as { contact?: string }).contact === lead.contact),
        10_000,
        'http sink request',
      );

      expect(delivery?.url).toBe('/leads');
      expect(delivery?.body).toMatchObject(lead);
      // Каскад получает id лида для дедупликации на своей стороне.
      expect((delivery?.body as { id?: string }).id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
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

      expect(delivery?.url).toBe('https://api.telegram.org/bot123456:test-token/sendMessage');
      expect(delivery?.params.chat_id).toBe('123456789');
      expect(delivery?.params.text).toBe(`From: ${lead.name} <${lead.contact}>\nMessage: ${lead.message}`);
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

      expect(delivery?.to).toBe('inbox@test.local');
      expect(delivery?.from).toBe('leads@test.local');
      expect(delivery?.subject).toBe(`New lead from ${lead.name}`);
      // Тело письма при передаче по SMTP может получить \r\n вместо \n,
      // поэтому сравнивается с нормализацией переводов строк
      const expectedText = `From: ${lead.name} <${lead.contact}>\nMessage: ${lead.message}`;

      expect(delivery?.text.replace(/\r\n/g, '\n').trim()).toBe(expectedText);
    });
  });

  // Idempotency tests
  describe('idempotency', () => {
    it('deduplicates concurrent requests independently for every channel', async (): Promise<void> => {
      const lead = LeadEntity.generate('Concurrent', 'concurrent@test.local', 'hello');

      await Promise.all([
        request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201),
        request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201),
      ]);

      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('retries missing channels without duplicating accepted jobs after a partial failure', async (): Promise<void> => {
      const lead = LeadEntity.generate('Retry', 'retry@test.local', 'hello');
      const realAdd = leadsQueue.add.bind(leadsQueue);
      const add = jest.spyOn(leadsQueue, 'add').mockImplementation((name, data, options): ReturnType<typeof realAdd> => {
        if (data.lead.id === lead.id && data.channel === ChannelEnum.EMAIL) {
          return Promise.reject(new Error('simulated enqueue failure'));
        }
        return realAdd(name, data, options);
      });

      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503);
        expect(await queuedChannels(lead.id)).toEqual(
          Object.values(ChannelEnum).filter((channel): boolean => channel !== ChannelEnum.EMAIL).sort(),
        );
      } finally {
        add.mockRestore();
      }

      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('does not acknowledge either concurrent request when all enqueue operations fail', async (): Promise<void> => {
      const lead = LeadEntity.generate('Unavailable', 'unavailable@test.local', 'hello');
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
});
