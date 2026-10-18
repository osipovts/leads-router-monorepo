import { ChannelEnum, generateLeadId, InfrastructureException, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import type { LeadsQueueConfigType } from '../../leads.config';
import { EnqueueFailedException } from '../exceptions/enqueue-failed.exception';
import type { QueuePort } from '../ports/queue.port';
import { BroadcastLeadUseCase } from './broadcast-lead.use-case';

const CONFIG = {
  attempts: 3,
  backoff: 5_000,
  completedRetentionMs: 3_600_000,
  failedRetentionMs: 2_592_000_000,
} satisfies LeadsQueueConfigType;

class QueueFake implements QueuePort {
  readonly sent: Array<{ channel: ChannelEnum; lead: LeadEntity; attempts: number; backoff: number }> = [];
  readonly failChannels = new Set<ChannelEnum>();

  sendLead(channel: ChannelEnum, lead: LeadEntity, attempts: number, backoff: number): Promise<void> {
    if (this.failChannels.has(channel)) {
      return Promise.reject(new Error(`enqueue failed for '${channel}'`));
    }

    this.sent.push({ channel, lead, attempts, backoff });
    return Promise.resolve();
  }
}

describe('BroadcastLeadUseCase', () => {
  let loggerLog: jest.SpiedFunction<Logger['log']>;
  let queue: QueueFake;
  let useCase: BroadcastLeadUseCase;

  const makeLead = (): LeadEntity => new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');

  beforeAll((): void => {
    loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    loggerLog.mockRestore();
  });

  beforeEach((): void => {
    queue = new QueueFake();
    useCase = new BroadcastLeadUseCase(CONFIG, queue);
  });

  it('enqueues a lead to every channel with retry options', async (): Promise<void> => {
    const lead = makeLead();

    await useCase.execute(lead);

    expect(queue.sent.map(({ channel }): ChannelEnum => channel)).toEqual(Object.values(ChannelEnum));
    for (const entry of queue.sent) {
      expect(entry.lead).toBe(lead);
      expect(entry.attempts).toBe(CONFIG.attempts);
      expect(entry.backoff).toBe(CONFIG.backoff);
    }
  });

  it('reports failed channels and allows retrying the same lead', async (): Promise<void> => {
    queue.failChannels.add(ChannelEnum.TELEGRAM);
    queue.failChannels.add(ChannelEnum.EMAIL);
    const lead = makeLead();

    await expect(useCase.execute(lead)).rejects.toMatchObject({
      details: { failedChannels: [ChannelEnum.TELEGRAM, ChannelEnum.EMAIL] },
    });

    queue.failChannels.clear();
    await useCase.execute(lead);

    expect(queue.sent.filter(({ channel }): boolean => channel === ChannelEnum.TELEGRAM)).toHaveLength(1);
    expect(queue.sent.filter(({ channel }): boolean => channel === ChannelEnum.EMAIL)).toHaveLength(1);
  });

  it('does not acknowledge concurrent requests before their enqueue operations finish', async (): Promise<void> => {
    let rejectEnqueue!: (reason: Error) => void;
    const enqueue = new Promise<void>((_resolve, reject): void => {
      rejectEnqueue = reject;
    });
    const send = jest.spyOn(queue, 'sendLead').mockReturnValue(enqueue);
    const lead = makeLead();
    const requests = Promise.allSettled([useCase.execute(lead), useCase.execute(lead)]);

    expect(send).toHaveBeenCalledTimes(Object.values(ChannelEnum).length * 2);
    rejectEnqueue(new Error('Redis unavailable'));

    const results = await requests;
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(EnqueueFailedException);
      }
    }
  });

  it('throws an infrastructure exception when every channel fails', async (): Promise<void> => {
    for (const channel of Object.values(ChannelEnum)) {
      queue.failChannels.add(channel);
    }

    await expect(useCase.execute(makeLead())).rejects.toBeInstanceOf(InfrastructureException);
  });
});
