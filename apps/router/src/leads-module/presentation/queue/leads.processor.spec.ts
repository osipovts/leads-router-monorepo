import { ChannelEnum, LayerEnum, LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { TelegramApiError } from 'node-telegram-bot-api';

import { UnsupportedLeadChannelException } from '../../application/exceptions/unsupported-lead-channel.exception';
import { SendLeadUseCase } from '../../application/use-cases/send-lead.use-case';
import { HttpLeadDeliveryException } from '../../infrastructure/delivery/http-lead-delivery/http-lead-delivery.exception';
import { TelegramLeadDeliveryException } from '../../infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.exception';
import { leadsWorkerConfig } from '../../leads.config';
import { LeadsProcessor } from './leads.processor';

class SendLeadUseCaseFake {
  readonly calls: Array<{ channel: ChannelEnum; lead: LeadEntity }> = [];

  execute(channel: ChannelEnum, lead: LeadEntity): Promise<void> {
    this.calls.push({ channel, lead });
    return Promise.resolve();
  }
}

const VALID_PAYLOAD = {
  id: '0f14d0ab-9605-4a62-a9e4-5ed26688389b',
  name: 'Иван',
  contact: 'ivan@example.com',
  message: 'hello',
} satisfies SendLeadJob['lead'];

function makeJob(name: string, data: SendLeadJob): Pick<Job<SendLeadJob>, 'name' | 'data'> {
  return { name, data };
}

// Некорректный лид и неизвестное имя задачи приводят к UnrecoverableError без повторов.
describe('LeadsProcessor', () => {
  let useCase: SendLeadUseCaseFake;
  let processor: LeadsProcessor;
  let module: TestingModule;

  beforeEach(async (): Promise<void> => {
    useCase = new SendLeadUseCaseFake();
    module = await Test.createTestingModule({
      providers: [
        LeadsProcessor,
        { provide: SendLeadUseCase, useValue: useCase },
        { provide: leadsWorkerConfig.KEY, useValue: { concurrency: 1 } },
      ],
    }).compile();
    processor = module.get(LeadsProcessor);
  });

  afterEach(async (): Promise<void> => {
    await module.close();
  });

  it('rehydrates the lead entity and dispatches it to the use case', async () => {
    await processor.process(makeJob(QUEUES.LEADS.JOBS.SEND, { channel: ChannelEnum.CONSOLE, lead: VALID_PAYLOAD }));

    expect(useCase.calls).toHaveLength(1);
    expect(useCase.calls[0].channel).toBe(ChannelEnum.CONSOLE);
    expect(useCase.calls[0].lead).toBeInstanceOf(LeadEntity);
    expect(useCase.calls[0].lead.id).toBe(VALID_PAYLOAD.id);
  });

  it('fails a corrupted payload as unrecoverable with the domain error JSON', async () => {
    const lead = { ...VALID_PAYLOAD };
    Reflect.set(lead, 'name', 42);
    const job = makeJob(QUEUES.LEADS.JOBS.SEND, {
      channel: ChannelEnum.CONSOLE,
      lead,
    });

    const error: unknown = await processor.process(job).then(
      () => undefined,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnrecoverableError);
    if (!(error instanceof UnrecoverableError)) {
      throw new Error('expected UnrecoverableError');
    }
    const parsed: unknown = JSON.parse(error.message);
    expect(parsed).toMatchObject({ layer: LayerEnum.DOMAIN, error: 'InvalidLeadException' });
    expect(useCase.calls).toEqual([]);
  });

  it('fails an unknown job name as unrecoverable without dispatching', async () => {
    const job = makeJob('unknown-job', { channel: ChannelEnum.CONSOLE, lead: VALID_PAYLOAD });
    await expect(processor.process(job)).rejects.toMatchObject({
      message: "Unsupported job 'unknown-job'",
    });
    expect(useCase.calls).toEqual([]);
  });

  it('rejects an unknown channel before dispatching', async (): Promise<void> => {
    const data = { channel: ChannelEnum.CONSOLE, lead: VALID_PAYLOAD };
    Reflect.set(data, 'channel', 'unknown');

    await expect(processor.process(makeJob(QUEUES.LEADS.JOBS.SEND, data))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(useCase.calls).toEqual([]);
  });

  it('does not retry an unregistered adapter', async (): Promise<void> => {
    jest.spyOn(useCase, 'execute').mockRejectedValue(new UnsupportedLeadChannelException(ChannelEnum.HTTP));
    const job = makeJob(QUEUES.LEADS.JOBS.SEND, { channel: ChannelEnum.HTTP, lead: VALID_PAYLOAD });

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('does not retry a delivery failure the adapter marked permanent', async (): Promise<void> => {
    jest
      .spyOn(useCase, 'execute')
      .mockRejectedValue(new HttpLeadDeliveryException([{ endpoint: 'http://one.test/leads', status: 404, isRetryable: false }], 1));
    const job = makeJob(QUEUES.LEADS.JOBS.SEND, { channel: ChannelEnum.HTTP, lead: VALID_PAYLOAD });

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('retries a delivery failure the adapter marked retryable', async (): Promise<void> => {
    jest
      .spyOn(useCase, 'execute')
      .mockRejectedValue(new TelegramLeadDeliveryException(new TelegramApiError(500, 'server error')));
    const job = makeJob(QUEUES.LEADS.JOBS.SEND, { channel: ChannelEnum.TELEGRAM, lead: VALID_PAYLOAD });
    const result = await Promise.allSettled([processor.process(job)]);
    const failure = result[0];

    expect(failure.status).toBe('rejected');
    if (failure.status === 'rejected') {
      expect(failure.reason).not.toBeInstanceOf(UnrecoverableError);
      expect(failure.reason).toBeInstanceOf(Error);
    }
  });

  it('keeps unknown delivery failures retryable without exposing their messages', async (): Promise<void> => {
    jest.spyOn(useCase, 'execute').mockRejectedValue(new Error('private lead contact'));
    const job = makeJob(QUEUES.LEADS.JOBS.SEND, { channel: ChannelEnum.HTTP, lead: VALID_PAYLOAD });
    const result = await Promise.allSettled([processor.process(job)]);
    const failure = result[0];

    expect(failure.status).toBe('rejected');
    if (failure.status === 'rejected') {
      expect(failure.reason).not.toBeInstanceOf(UnrecoverableError);
      expect(failure.reason).toMatchObject({
        message: JSON.stringify({ error: 'Error', message: 'Lead delivery failed' }),
      });
    }
  });
});
