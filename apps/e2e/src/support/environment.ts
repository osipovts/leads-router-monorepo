import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import type { Server as HttpServer } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ChannelEnum, QUEUES, type SendLeadJob } from '@leads-router/common';
import { getQueueToken } from '@nestjs/bullmq';
import { type INestApplication, type INestApplicationContext, Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Job, Queue } from 'bullmq';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

import { AppModule as GatewayAppModule } from '../../../gateway/src/app.module';
import { HttpExceptionFilter } from '../../../gateway/src/common/presentation/http/http-exception.filter';
import { HttpLoggingInterceptor } from '../../../gateway/src/common/presentation/http/http-logging.interceptor';
import { HttpValidationPipe } from '../../../gateway/src/common/presentation/http/http-validation.pipe';
import { AppModule as RouterAppModule } from '../../../router/src/app.module';
import { PrismaService } from '../../../router/src/common/infrastructure/prisma/prisma.service';
import { type HttpSink, startHttpSink } from './http-sink';
import { type SmtpSink, startSmtpSink } from './smtp-sink';
import { startTelegramApiSink, type TelegramApiSink } from './telegram-api-sink';
import { waitFor } from './wait-for';

export interface PostedLead {
  lead: { name: string; contact: string; message: string };
  response: request.Response;
}

/**
 * Окружение полного пути лида, общее для всех групп тестов: контейнеры, синки каналов,
 * две реплики gateway и router. Поднимается один раз — каждая группа фильтрует свои
 * эффекты по уникальному лиду.
 */
export interface E2eEnvironment {
  readonly postgres: StartedTestContainer;
  readonly redis: StartedTestContainer;
  readonly http: HttpSink;
  readonly smtp: SmtpSink;
  readonly telegramApi: TelegramApiSink;
  readonly gatewayApp: INestApplication<HttpServer>;
  // Вторая реплика за тем же балансировщиком: делит с первой Redis и лимит запросов
  readonly gatewayReplica: INestApplication<HttpServer>;
  readonly routerApp: INestApplicationContext;
  readonly prisma: PrismaService;
  readonly leadsQueue: Queue<SendLeadJob>;
  readonly adapterLog: jest.SpyInstance;
  readonly useCaseVerbose: jest.SpyInstance;
  readonly heartbeatFile: string;
  readonly queuedChannels: (id: string) => Promise<ChannelEnum[]>;
  readonly settledHttpJob: (id: string) => Promise<Job<SendLeadJob>>;
  readonly waitForQueueIdle: () => Promise<void>;
  readonly postLead: (label: string) => Promise<PostedLead>;
}

export type Cleanup = () => unknown;

// Настройка повторяет gateway main.ts: версия API, префикс и глобальные
// обработчики регистрируются при запуске, а не в AppModule.
const startGateway = async (): Promise<INestApplication<HttpServer>> => {
  const app = await NestFactory.create<INestApplication<HttpServer>>(GatewayAppModule);
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalPipes(new HttpValidationPipe());
  // Общий сервер остаётся открытым до afterAll, в том числе для параллельных запросов supertest.
  await app.listen(0, '127.0.0.1');

  return app;
};

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

/**
 * Поднимает окружение. Каждый ресурс сразу после создания кладёт своё закрытие в cleanups:
 * если запуск оборвётся на середине, afterAll закроет уже созданное в обратном порядке.
 */
export async function startEnvironment(cleanups: Cleanup[]): Promise<E2eEnvironment> {
  // Фиксированный host-порт postgres: тест остановки БД поднимает контейнер заново через
  // docker start, а динамический порт при этом выделяется заново и не совпадает со старым
  const postgresHostPort = await reserveHostPort();

  const postgres = await new GenericContainer('postgres:18-alpine')
    .withEnvironment({ POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres', POSTGRES_DB: 'leads' })
    .withExposedPorts({ container: 5432, host: postgresHostPort })
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();
  cleanups.push(() => postgres.stop());

  const redis = await new GenericContainer('redis:8-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();
  cleanups.push(() => redis.stop());

  const databaseUrl = `postgresql://postgres:postgres@${postgres.getHost()}:${postgres.getMappedPort(5432).toString()}/leads?schema=public`;

  execFileSync('pnpm', ['--filter', '@leads-router/router', 'exec', 'prisma', 'migrate', 'deploy'], {
    cwd: join(__dirname, '..', '..', '..', '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const http = await startHttpSink();
  cleanups.push(() => http.close());
  const smtp = await startSmtpSink();
  cleanups.push(() => smtp.close());
  const heartbeatFile = join(tmpdir(), `router-heartbeat-${process.pid.toString()}`);
  cleanups.push(() => rm(heartbeatFile, { force: true }));

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
  // Три попытки с паузами 50 и 100 мс: тесты исчерпания попыток укладываются в таймауты waitFor
  process.env.LEADS_QUEUE_ATTEMPTS = '3';
  process.env.LEADS_WORKER_HEARTBEAT_FILE = heartbeatFile;
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
  const telegramApi = startTelegramApiSink('123456:test-token');
  cleanups.push(() => {
    telegramApi.restore();
  });

  // Nest Logger захватывает ссылки на console при создании экземпляров,
  // поэтому перехватываются методы prototype класса.
  const adapterLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const useCaseVerbose = jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  const gatewayApp = await startGateway();
  cleanups.push(() => gatewayApp.close());
  const gatewayReplica = await startGateway();
  cleanups.push(() => gatewayReplica.close());
  const leadsQueue = gatewayApp.get<Queue<SendLeadJob>>(getQueueToken(QUEUES.LEADS.QUEUE_NAME));
  await leadsQueue.waitUntilReady();

  const routerApp = await NestFactory.createApplicationContext(RouterAppModule);
  cleanups.push(() => routerApp.close());
  const prisma = routerApp.get(PrismaService);

  let leadSeq = 0;

  return {
    postgres,
    redis,
    http,
    smtp,
    telegramApi,
    gatewayApp,
    gatewayReplica,
    routerApp,
    prisma,
    leadsQueue,
    adapterLog,
    useCaseVerbose,
    heartbeatFile,

    queuedChannels: async (id: string): Promise<ChannelEnum[]> => {
      const jobs = await leadsQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
      return jobs
        .filter((job): boolean => job.data.lead.id === id)
        .map((job): ChannelEnum => job.data.channel)
        .sort();
    },

    settledHttpJob: (id: string): Promise<Job<SendLeadJob>> =>
      waitFor(
        async (): Promise<Job<SendLeadJob> | undefined> => {
          const jobs = await leadsQueue.getJobs(['completed', 'failed']);
          return jobs.find((entry): boolean => entry.data.lead.id === id && entry.data.channel === ChannelEnum.HTTP);
        },
        10_000,
        'HTTP delivery job settled',
      ),

    waitForQueueIdle: async (): Promise<void> => {
      await waitFor(async (): Promise<boolean> => {
        const counts = await leadsQueue.getJobCounts('waiting', 'active', 'delayed');
        return counts.waiting === 0 && counts.active === 0 && counts.delayed === 0;
      });
    },

    postLead: async (label: string): Promise<PostedLead> => {
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
    },
  };
}
