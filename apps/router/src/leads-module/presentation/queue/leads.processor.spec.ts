import { ChannelEnum, LayerEnum, LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';

import type { SendLeadUseCase } from '../../application/use-cases/send-lead.use-case';
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

function makeJob(name: string, data: unknown): Job<SendLeadJob> {
  return { name, data } as Job<SendLeadJob>;
}

// Payload из очереди не доверяется: битый лид и неизвестное имя джобы - UnrecoverableError без ретраев
describe('LeadsProcessor', () => {
  let useCase: SendLeadUseCaseFake;
  let processor: LeadsProcessor;

  beforeEach(() => {
    useCase = new SendLeadUseCaseFake();
    processor = new LeadsProcessor(useCase as unknown as SendLeadUseCase);
  });

  it('rehydrates the lead entity and dispatches it to the use case', async () => {
    await processor.process(makeJob(QUEUES.LEADS.JOBS.SEND, { channel: ChannelEnum.CONSOLE, lead: VALID_PAYLOAD }));

    expect(useCase.calls).toHaveLength(1);
    expect(useCase.calls[0].channel).toBe(ChannelEnum.CONSOLE);
    expect(useCase.calls[0].lead).toBeInstanceOf(LeadEntity);
    expect(useCase.calls[0].lead.id).toBe(VALID_PAYLOAD.id);
  });

  it('fails a corrupted payload as unrecoverable with the domain error JSON', async () => {
    const job = makeJob(QUEUES.LEADS.JOBS.SEND, {
      channel: ChannelEnum.CONSOLE,
      lead: { ...VALID_PAYLOAD, name: 42 as unknown as string },
    });

    const error: unknown = await processor.process(job).then(
      () => undefined,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnrecoverableError);
    const parsed = JSON.parse((error as UnrecoverableError).message) as { layer: string; error: string };
    expect(parsed.layer).toBe(LayerEnum.DOMAIN);
    expect(parsed.error).toBe('InvalidLeadException');
    expect(useCase.calls).toEqual([]);
  });

  it('fails an unknown job name as unrecoverable without dispatching', async () => {
    await expect(processor.process(makeJob('unknown-job', {}))).rejects.toMatchObject({
      message: "Unsupported job 'unknown-job'",
    });
    expect(useCase.calls).toEqual([]);
  });
});
