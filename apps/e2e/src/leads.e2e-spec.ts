import { execFileSync } from 'node:child_process';
import type { Server as HttpServer } from 'node:http';
import { join } from 'node:path';

import request from 'supertest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

import { VersioningType } from '../../gateway/node_modules/@nestjs/common';
// Импорт из дерева gateway гарантирует тот же самый экземпляр @nestjs/core,
// которым бутстрапится само приложение: две копии Nest в одном процессе
// сломали бы DI-контейнеры и instanceof-проверки
import { NestFactory } from '../../gateway/node_modules/@nestjs/core';
import { AppModule as GatewayAppModule } from '../../gateway/src/app.module';
import { HttpExceptionFilter } from '../../gateway/src/common/presentation/http/http-exception.filter';
import { HttpLoggingInterceptor } from '../../gateway/src/common/presentation/http/http-logging.interceptor';
import { HttpValidationPipe } from '../../gateway/src/common/presentation/http/http-validation.pipe';
// Logger из дерева router это тот же класс, экземпляры которого используют
// delivery-адаптеры: шпион за prototype ловит их вызовы
import { Logger as RouterLogger } from '../../router/node_modules/@nestjs/common';
import { AppModule as RouterAppModule } from '../../router/src/app.module';
import { PrismaService } from '../../router/src/common/infrastructure/prisma/prisma.service';
import { type HttpSink, startHttpSink } from './support/http-sink';
import { waitFor } from './support/wait-for';

jest.setTimeout(240_000);

describe('Lead broadcast full path: gateway -> BullMQ -> router -> delivery adapters', () => {
  // Переменные присваиваются в beforeAll: jest не выполняет тесты,
  // если beforeAll упал, поэтому в самих тестах они гарантированно заполнены
  let postgres!: StartedTestContainer;
  let redis!: StartedTestContainer;
  let sink!: HttpSink;
  let gatewayApp!: Awaited<ReturnType<typeof NestFactory.create>>;
  let routerApp!: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  let prisma!: PrismaService;
  let adapterLog!: jest.SpyInstance;
  let useCaseWarn!: jest.SpyInstance;

  let leadSeq = 0;

  const postLead = async (
    label: string,
  ): Promise<{ lead: { name: string; contact: string; message: string }; response: request.Response }> => {
    leadSeq += 1;

    // Уникальный contact это маркер конкретного теста: gateway бродкастит каждый
    // лид во все каналы, поэтому тесты изолируются фильтрацией по contact
    const lead = {
      name: `E2E ${label}`,
      contact: `e2e-${label}-${Date.now().toString()}-${leadSeq.toString()}@test.local`,
      message: `integration test lead (${label})`,
    };

    const response = await request(gatewayApp.getHttpServer() as HttpServer)
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

    sink = await startHttpSink();

    // Оба приложения читают process.env при инициализации конфигов,
    // поэтому переменные выставляются до их создания
    process.env.DATABASE_URL = databaseUrl;
    process.env.BULLMQ_CONNECTION_HOST = redis.getHost();
    process.env.BULLMQ_CONNECTION_PORT = redis.getMappedPort(6379).toString();
    delete process.env.BULLMQ_CONNECTION_PASSWORD;

    process.env.CONSOLE_LEAD_DELIVERY_ENABLED = 'true';
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'true';
    process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'false';
    process.env.TELEGRAM_LEAD_DELIVERY_CHAT_ID = '123456789';
    process.env.TELEGRAM_CLIENT_TOKEN = '123456:test-token';
    process.env.HTTP_LEAD_DELIVERY_ENABLED = 'true';
    process.env.HTTP_LEAD_DELIVERY_ENDPOINTS = `http://127.0.0.1:${sink.port.toString()}/leads`;
    process.env.HTTP_CLIENT_TIMEOUT = '2000';
    process.env.HTTP_CLIENT_RETRY_COUNT = '1';

    // Nest Logger захватывает ссылки на console при создании экземпляров,
    // поэтому надёжнее шпионить за prototype класса из дерева router
    adapterLog = jest.spyOn(RouterLogger.prototype, 'log').mockImplementation(() => undefined);
    useCaseWarn = jest.spyOn(RouterLogger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Bootstrap повторяет gateway main.ts: versioning, префикс и глобальные
    // pipe/interceptor/filter регистрируются там, а не в AppModule
    gatewayApp = await NestFactory.create(GatewayAppModule);
    gatewayApp.enableVersioning({ type: VersioningType.URI });
    gatewayApp.setGlobalPrefix('api');
    gatewayApp.useGlobalFilters(new HttpExceptionFilter());
    gatewayApp.useGlobalInterceptors(new HttpLoggingInterceptor());
    gatewayApp.useGlobalPipes(new HttpValidationPipe());
    await gatewayApp.init();

    routerApp = await NestFactory.createApplicationContext(RouterAppModule);
    prisma = routerApp.get(PrismaService);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await gatewayApp.close();
    await routerApp.close();
    await sink.close();
    await postgres.stop();
    await redis.stop();
  });

  // Gateway tests
  describe('gateway', () => {
    it('accepts a valid lead and responds with echoed data', async () => {
      const { lead, response } = await postLead('gateway-valid');

      expect(response.body).toEqual({ success: true, data: lead });
    });

    it('rejects an invalid lead with a validation error', async () => {
      const response = await request(gatewayApp.getHttpServer() as HttpServer)
        .post('/api/v1/leads')
        .send({ name: '' })
        .expect(400);

      const body = response.body as { success: boolean; error: { error: string } };

      expect(body.success).toBe(false);
      expect(body.error.error).toBe('BadRequestException');
    });
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
        () => sink.requests.find((entry) => (entry.body as { contact?: string }).contact === lead.contact),
        10_000,
        'http sink request',
      );

      expect(delivery?.url).toBe('/leads');
      expect(delivery?.body).toEqual(lead);
    });
  });

  // Disabled channel test
  describe('disabled channels', () => {
    it('router skips disabled telegram channel with warning', async () => {
      // Warn не содержит идентификатора лида, поэтому тест фиксирует счётчик
      // вызовов до отправки и ждёт его увеличения
      const warnsBefore = useCaseWarn.mock.calls.length;

      await postLead('telegram-skip');

      await waitFor(() => useCaseWarn.mock.calls.length > warnsBefore, 10_000, 'telegram skip warning');
    });
  });
});
