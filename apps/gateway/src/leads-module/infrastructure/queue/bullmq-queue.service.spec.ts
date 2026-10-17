import { ChannelEnum, InfrastructureException, LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';

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

  beforeAll((): void => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    loggerError.mockRestore();
  });

  beforeEach(async (): Promise<void> => {
    loggerError.mockClear();
    add = jest.fn();
    module = await Test.createTestingModule({
      providers: [
        BullmqQueueService,
        { provide: getQueueToken(QUEUES.LEADS.QUEUE_NAME), useValue: { add } },
        { provide: leadsQueueConfig.KEY, useValue: CONFIG },
        { provide: leadsDeduplicationConfig.KEY, useValue: DEDUPLICATION_CONFIG },
      ],
    }).compile();
    service = module.get(BullmqQueueService);
  });

  afterEach(async (): Promise<void> => {
    await module.close();
  });

  it('adds a job with retries, retention and atomic deduplication per channel', async (): Promise<void> => {
    const lead = LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

    await service.sendLead(ChannelEnum.TELEGRAM, lead, CONFIG.attempts, CONFIG.backoff);

    expect(add).toHaveBeenCalledWith(
      QUEUES.LEADS.JOBS.SEND,
      { channel: ChannelEnum.TELEGRAM, lead },
      {
        attempts: CONFIG.attempts,
        backoff: CONFIG.backoff,
        deduplication: { id: `${lead.id}-telegram`, ttl: DEDUPLICATION_CONFIG.ttlMs },
        removeOnComplete: { age: 3_600 },
        removeOnFail: { age: 2_592_000 },
      },
    );
  });

  it('uses different deduplication keys for different channels', async (): Promise<void> => {
    const lead = LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

    await service.sendLead(ChannelEnum.EMAIL, lead, CONFIG.attempts, CONFIG.backoff);
    await service.sendLead(ChannelEnum.TELEGRAM, lead, CONFIG.attempts, CONFIG.backoff);

    expect(add.mock.calls[0][2]?.deduplication?.id).not.toBe(add.mock.calls[1][2]?.deduplication?.id);
  });

  it('throws a typed exception without logging lead data when enqueue fails', async (): Promise<void> => {
    add.mockRejectedValue(new Error('connection refused'));
    const lead = LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

    await expect(service.sendLead(ChannelEnum.EMAIL, lead, CONFIG.attempts, CONFIG.backoff)).rejects.toBeInstanceOf(
      QueueUnavailableException,
    );
    expect(loggerError).toHaveBeenCalledTimes(1);
    const loggedJson = JSON.stringify(loggerError.mock.calls);

    expect(loggedJson).toContain(`"channel":"${ChannelEnum.EMAIL}"`);
    expect(loggedJson).toContain(`"leadId":"${lead.id}"`);
    expect(loggedJson).not.toContain(lead.contact);
    expect(loggedJson).not.toContain(lead.message);
  });

  it('maps to the infrastructure layer for the http exception mapper', (): void => {
    expect(new QueueUnavailableException()).toBeInstanceOf(InfrastructureException);
  });
});
