import { EventEmitter } from 'node:events';

import {
  ChannelEnum,
  generateLeadId,
  InfrastructureException,
  LeadEntity,
  QUEUES,
  type SendLeadJob,
} from '@leads-router/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue, RedisConnection } from 'bullmq';

import { leadsDeduplicationConfig, leadsQueueConfig, type LeadsQueueConfigType } from '../../leads.config';
import { BullmqQueueService } from './bullmq-queue.service';
import { QueueUnavailableException } from './queue-unavailable.exception';

const CONFIG = {
  attempts: 3,
  backoff: 5_000,
  completedRetentionMs: 3_600_000,
  failedRetentionMs: 2_592_000_000,
} satisfies LeadsQueueConfigType;

const DEDUPLICATION_CONFIG = { ttlMs: 86_400_000 };

describe('BullmqQueueService', () => {
  let loggerError: jest.SpiedFunction<Logger['error']>;
  let add: jest.MockedFunction<Queue<SendLeadJob>['add']>;
  let module: TestingModule;
  let service: BullmqQueueService;
  let events: EventEmitter;
  let connectionStatus: RedisConnection['status'];

  beforeAll((): void => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    loggerError.mockRestore();
  });

  beforeEach(async (): Promise<void> => {
    loggerError.mockClear();
    add = jest.fn();
    events = new EventEmitter();
    connectionStatus = 'ready';
    module = await Test.createTestingModule({
      providers: [
        BullmqQueueService,
        {
          provide: getQueueToken(QUEUES.LEADS.QUEUE_NAME),
          useValue: {
            add,
            on: events.on.bind(events),
            getBackend: (): { connection: Pick<RedisConnection, 'status'> } => ({
              connection: {
                get status(): RedisConnection['status'] {
                  return connectionStatus;
                },
              },
            }),
          },
        },
        { provide: leadsQueueConfig.KEY, useValue: CONFIG },
        { provide: leadsDeduplicationConfig.KEY, useValue: DEDUPLICATION_CONFIG },
      ],
    }).compile();
    service = module.get(BullmqQueueService);
  });

  afterEach(async (): Promise<void> => {
    await module.close();
  });

  it.each([
    ['ready', true],
    ['initializing', false],
    ['closing', false],
    ['closed', false],
  ] as const)('reports a %s Redis connection as ready=%s', (status, ready): void => {
    connectionStatus = status;

    expect(service.isReady()).toBe(ready);
  });

  it('adds a job with retries, retention and atomic deduplication per channel', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');

    await service.sendLead(ChannelEnum.TELEGRAM, lead);

    expect(add).toHaveBeenCalledWith(
      QUEUES.LEADS.JOBS.SEND,
      { channel: ChannelEnum.TELEGRAM, lead },
      {
        attempts: CONFIG.attempts,
        backoff: { type: QUEUES.LEADS.BACKOFF_STRATEGY, delay: CONFIG.backoff },
        deduplication: { id: `${lead.id}-telegram`, ttl: DEDUPLICATION_CONFIG.ttlMs },
        removeOnComplete: { age: 3_600 },
        removeOnFail: { age: 2_592_000 },
      },
    );
  });

  it('uses different deduplication keys for different channels', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');

    await service.sendLead(ChannelEnum.EMAIL, lead);
    await service.sendLead(ChannelEnum.TELEGRAM, lead);

    expect(add.mock.calls[0][2]?.deduplication?.id).not.toBe(add.mock.calls[1][2]?.deduplication?.id);
  });

  it('deduplicates UUIDs independently of their letter case', async (): Promise<void> => {
    const id = '0F14D0AB-9605-4A62-A9E4-5ED26688389B';
    const upper = new LeadEntity(id, 'Ivan', 'ivan@example.com', 'hello');
    const lower = new LeadEntity(id.toLowerCase(), upper.name, upper.contact, upper.message);

    await service.sendLead(ChannelEnum.EMAIL, upper);
    await service.sendLead(ChannelEnum.EMAIL, lower);

    expect(add.mock.calls[0][2]?.deduplication?.id).toBe(add.mock.calls[1][2]?.deduplication?.id);
  });

  it('logs asynchronous queue connection errors', (): void => {
    events.emit('error', new Error('Redis unavailable'));
    expect(loggerError).toHaveBeenCalledWith({
      event: 'leads_queue_error',
      error: 'Error',
      message: 'Redis unavailable',
    });
  });

  it('rejects enqueue before the first Redis connection is ready', async (): Promise<void> => {
    connectionStatus = 'initializing';
    const lead = new LeadEntity(generateLeadId(), 'Ivan', 'ivan@example.com', 'hello');

    await expect(service.sendLead(ChannelEnum.EMAIL, lead)).rejects.toBeInstanceOf(QueueUnavailableException);
    expect(add).not.toHaveBeenCalled();
    // Отказ до подключения — штатная деградация: error-уровень не задействуется
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('throws a typed exception without logging lead data when enqueue fails', async (): Promise<void> => {
    add.mockRejectedValue(new Error('connection refused'));
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');

    await expect(service.sendLead(ChannelEnum.EMAIL, lead)).rejects.toBeInstanceOf(QueueUnavailableException);
    expect(loggerError).toHaveBeenCalledTimes(1);
    const loggedJson = JSON.stringify(loggerError.mock.calls);

    expect(loggedJson).toContain(`"channel":"${ChannelEnum.EMAIL}"`);
    expect(loggedJson).toContain(`"leadId":"${lead.id}"`);
    expect(loggedJson).not.toContain(lead.contact);
    expect(loggedJson).not.toContain(lead.message);
  });

  it('does not log the Redis command arguments carried by a reply error', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    // ioredis ReplyError хранит в command.args сериализованную задачу вместе с данными лида
    const replyError = Object.assign(new Error('OOM command not allowed'), {
      command: { name: 'evalsha', args: [JSON.stringify({ channel: ChannelEnum.EMAIL, lead })] },
    });
    add.mockRejectedValue(replyError);

    await expect(service.sendLead(ChannelEnum.EMAIL, lead)).rejects.toBeInstanceOf(QueueUnavailableException);
    expect(loggerError).toHaveBeenCalledWith({
      channel: ChannelEnum.EMAIL,
      leadId: lead.id,
      error: 'Error',
      message: 'OOM command not allowed',
    });
  });

  it('maps to the infrastructure layer for the http exception mapper', (): void => {
    expect(new QueueUnavailableException()).toBeInstanceOf(InfrastructureException);
  });
});
