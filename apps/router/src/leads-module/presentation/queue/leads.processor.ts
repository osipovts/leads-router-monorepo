import {
  ChannelEnum,
  Exception,
  LeadEntity,
  LeadEntityValidation,
  QUEUES,
  type SendLeadJob,
} from '@leads-router/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import z from 'zod';

import { SendLeadUseCase } from '../../application/use-cases/send-lead.use-case';
import { isRetryableDeliveryError } from '../../infrastructure/delivery/is-retryable-delivery-error';

const channelSchema = z.enum(ChannelEnum);
const metadataSchema = z.object({
  channel: channelSchema,
  lead: z.object({ id: z.string().regex(LeadEntityValidation.id.pattern) }),
});

@Processor(QUEUES.LEADS.QUEUE_NAME)
export class LeadsProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadsProcessor.name);

  constructor(private readonly sendLeadUseCase: SendLeadUseCase) {
    super();
  }

  async process(job: Pick<Job<SendLeadJob>, 'name' | 'data'>): Promise<void> {
    if (job.name !== QUEUES.LEADS.JOBS.SEND) {
      throw new UnrecoverableError(`Unsupported job '${job.name}'`);
    }

    let lead: LeadEntity;
    let channel: ChannelEnum;
    try {
      channel = channelSchema.parse(job.data.channel);
      lead = LeadEntity.from(job.data.lead);
    } catch (error: unknown) {
      throw new UnrecoverableError(JSON.stringify(Exception.toJSON(error)));
    }

    try {
      await this.sendLeadUseCase.execute(channel, lead);
    } catch (error: unknown) {
      const failure =
        error instanceof Exception
          ? error.toJSON()
          : { error: error instanceof Error ? error.name : 'UnknownError', message: 'Lead delivery failed' };
      const message = JSON.stringify(failure);
      if (!isRetryableDeliveryError(error)) {
        throw new UnrecoverableError(message);
      }
      throw new Error(message, { cause: error });
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<unknown> | undefined, error: Error): void {
    const metadata = metadataSchema.safeParse(job?.data);
    this.logger.error({
      event: 'lead_delivery_failed',
      jobId: job?.id,
      leadId: metadata.success ? metadata.data.lead.id : undefined,
      channel: metadata.success ? metadata.data.channel : undefined,
      attemptsMade: job?.attemptsMade,
      reason: error.message,
    });
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error({ event: 'lead_worker_error', error: error.name, message: error.message });
  }
}
