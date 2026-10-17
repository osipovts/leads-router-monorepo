import { ChannelEnum, InfrastructureException, LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';

import type { LeadsQueueConfigType } from '../../leads.config';
import { BullmqQueueService } from './bullmq-queue.service';
import { QueueUnavailableException } from './queue-unavailable.exception';

const CONFIG = {
  attempts: 3,
  backoff: 5_000,
  completedRetentionMs: 3_600_000,
  failedRetentionMs: 2_592_000_000,
} satisfies LeadsQueueConfigType;

class QueueFake {
  readonly added: Array<{ name: string; data: unknown; options: JobsOptions | undefined }> = [];
  fail = false;

  add(name: string, data: unknown, options?: JobsOptions): Promise<void> {
    if (this.fail) {
      return Promise.reject(new Error('connection refused'));
    }

    this.added.push({ name, data, options });
    return Promise.resolve();
  }
}

describe('BullmqQueueService', () => {
  let loggerError: jest.SpyInstance;
  let queue: QueueFake;
  let service: BullmqQueueService;

  beforeAll(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    loggerError.mockRestore();
  });

  beforeEach(() => {
    queue = new QueueFake();
    service = new BullmqQueueService(queue as unknown as Queue, CONFIG);
  });

  it('adds a send-lead job with retry and retention options', async () => {
    const lead = LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

    await service.sendLead(ChannelEnum.TELEGRAM, lead, CONFIG.attempts, CONFIG.backoff);

    expect(queue.added).toHaveLength(1);
    const { name, data, options } = queue.added[0];
    const job = data as SendLeadJob;

    expect(name).toBe(QUEUES.LEADS.JOBS.SEND);
    expect(job.channel).toBe(ChannelEnum.TELEGRAM);
    expect(job.lead.id).toBe(lead.id);
    // Ретеншн BullMQ задаётся в секундах: мс из конфига делятся на 1000
    expect(options).toEqual({
      attempts: CONFIG.attempts,
      backoff: CONFIG.backoff,
      removeOnComplete: { age: 3_600 },
      removeOnFail: { age: 2_592_000 },
    });
  });

  it('throws a typed exception and logs only the lead id when enqueue fails', async () => {
    queue.fail = true;
    const lead = LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

    await expect(service.sendLead(ChannelEnum.EMAIL, lead, CONFIG.attempts, CONFIG.backoff)).rejects.toBeInstanceOf(
      QueueUnavailableException,
    );
    expect(queue.added).toEqual([]);
    expect(loggerError).toHaveBeenCalledTimes(1);
    // PII: в лог попадает только идентификатор, payload лида не логируется
    const loggedJson = JSON.stringify(loggerError.mock.calls);

    expect(loggedJson).toContain(`"channel":"${ChannelEnum.EMAIL}"`);
    expect(loggedJson).toContain(`"leadId":"${lead.id}"`);
    expect(loggedJson).not.toContain(lead.contact);
  });

  it('maps to the infrastructure layer for the http exception mapper', () => {
    expect(new QueueUnavailableException()).toBeInstanceOf(InfrastructureException);
  });
});
