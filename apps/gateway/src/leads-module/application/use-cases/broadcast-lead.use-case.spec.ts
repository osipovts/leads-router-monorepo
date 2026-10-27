import { ChannelEnum, generateLeadId, InfrastructureException, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import { EnqueueFailedException } from '../exceptions/enqueue-failed.exception';
import type { QueuePort } from '../ports/queue.port';
import { BroadcastLeadUseCase } from './broadcast-lead.use-case';

class QueueFake implements QueuePort {
  readonly sent: Array<{ channel: ChannelEnum; lead: LeadEntity }> = [];
  readonly failChannels = new Set<ChannelEnum>();

  isReady(): boolean {
    return true;
  }

  sendLead(channel: ChannelEnum, lead: LeadEntity): Promise<void> {
    if (this.failChannels.has(channel)) {
      return Promise.reject(new Error(`enqueue failed for '${channel}'`));
    }

    this.sent.push({ channel, lead });
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
    useCase = new BroadcastLeadUseCase(queue);
  });

  it('enqueues a lead to every channel', async (): Promise<void> => {
    const lead = makeLead();

    await useCase.execute(lead);

    expect(queue.sent.map(({ channel }): ChannelEnum => channel)).toEqual(Object.values(ChannelEnum));
    for (const entry of queue.sent) {
      expect(entry.lead).toBe(lead);
    }
  });

  it('reports the lead id and failed channels so the client can retry the same lead', async (): Promise<void> => {
    queue.failChannels.add(ChannelEnum.TELEGRAM);
    queue.failChannels.add(ChannelEnum.EMAIL);
    const lead = makeLead();

    // Без id в ответе клиент повторил бы запрос с новым id, и дедупликация не сработала бы
    // для каналов, уже принявших лид
    await expect(useCase.execute(lead)).rejects.toMatchObject({
      details: { leadId: lead.id, failedChannels: [ChannelEnum.TELEGRAM, ChannelEnum.EMAIL] },
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
