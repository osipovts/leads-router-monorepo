import { ChannelEnum, InfrastructureException, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import type { LeadsQueueConfigType } from '../../leads.config';
import { EnqueueFailedException } from '../exceptions/enqueue-failed.exception';
import type { LeadDeduplicationPort } from '../ports/lead-deduplication.port';
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

class DeduplicationFake implements LeadDeduplicationPort {
  firstSeen = true;
  readonly released: string[] = [];

  tryAcquire(): Promise<boolean> {
    return Promise.resolve(this.firstSeen);
  }

  release(id: string): Promise<void> {
    this.released.push(id);
    return Promise.resolve();
  }
}

// Ключевая логика идемпотентности: первый POST ставит маркер и рассылает во все каналы,
// дубль пропускается, частичная неудача enqueue снимает маркер и фейлит запрос
describe('BroadcastLeadUseCase', () => {
  let loggerLog: jest.SpyInstance;
  let loggerWarn: jest.SpyInstance;
  let queue: QueueFake;
  let deduplication: DeduplicationFake;
  let useCase: BroadcastLeadUseCase;

  const makeLead = (): LeadEntity => LeadEntity.generate('Иван', 'ivan@example.com', 'hello');

  beforeAll(() => {
    loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    loggerLog.mockRestore();
    loggerWarn.mockRestore();
  });

  beforeEach(() => {
    queue = new QueueFake();
    deduplication = new DeduplicationFake();
    useCase = new BroadcastLeadUseCase(CONFIG, queue, deduplication);
  });

  it('enqueues a first-seen lead to every channel with retry options', async () => {
    const lead = makeLead();

    await useCase.execute(lead);

    expect(queue.sent.map(({ channel }) => channel)).toEqual(Object.values(ChannelEnum));
    for (const entry of queue.sent) {
      expect(entry.lead).toBe(lead);
      expect(entry.attempts).toBe(CONFIG.attempts);
      expect(entry.backoff).toBe(CONFIG.backoff);
    }
    expect(deduplication.released).toEqual([]);
  });

  it('skips broadcast and keeps the marker for a duplicate lead', async () => {
    deduplication.firstSeen = false;

    await useCase.execute(makeLead());

    expect(queue.sent).toEqual([]);
    expect(deduplication.released).toEqual([]);
    expect(loggerWarn).toHaveBeenCalled();
  });

  it('releases the marker and fails when some channels fail to enqueue', async () => {
    queue.failChannels.add(ChannelEnum.TELEGRAM);
    queue.failChannels.add(ChannelEnum.EMAIL);
    const lead = makeLead();

    await expect(useCase.execute(lead)).rejects.toBeInstanceOf(EnqueueFailedException);
    await expect(useCase.execute(lead)).rejects.toMatchObject({
      details: { failedChannels: [ChannelEnum.TELEGRAM, ChannelEnum.EMAIL] },
    });

    // Маркер снят после каждой неудачи, чтобы повтор запроса с тем же id дошёл до каналов
    expect(deduplication.released).toEqual([lead.id, lead.id]);
    // Каналы с успешным enqueue лид всё же получили (повтор запроса продублирует их -
    // это документированная семантика at-least-once)
    expect(queue.sent.map(({ channel }) => channel)).toEqual([
      ChannelEnum.CONSOLE,
      ChannelEnum.DATABASE,
      ChannelEnum.HTTP,
      ChannelEnum.CONSOLE,
      ChannelEnum.DATABASE,
      ChannelEnum.HTTP,
    ]);
  });

  it('throws an infrastructure exception when every channel fails', async () => {
    for (const channel of Object.values(ChannelEnum)) {
      queue.failChannels.add(channel);
    }

    await expect(useCase.execute(makeLead())).rejects.toBeInstanceOf(InfrastructureException);
    expect(deduplication.released).toHaveLength(1);
  });
});
