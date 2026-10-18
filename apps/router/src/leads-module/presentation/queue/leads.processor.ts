import {
  ChannelEnum,
  Exception,
  LeadEntity,
  LeadEntityValidation,
  QUEUES,
  type SendLeadJob,
} from '@leads-router/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { type BeforeApplicationShutdown, Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import z from 'zod';

import { LeadDeliveryException } from '../../application/exceptions/lead-delivery.exception';
import { UnsupportedLeadChannelException } from '../../application/exceptions/unsupported-lead-channel.exception';
import { SendLeadUseCase } from '../../application/use-cases/send-lead.use-case';
import { type LeadsWorkerConfig, leadsWorkerConfig } from '../../leads.config';

const channelSchema = z.enum(ChannelEnum);
const metadataSchema = z.object({
  channel: channelSchema,
  lead: z.object({ id: z.string().regex(LeadEntityValidation.id.pattern) }),
});

@Processor(QUEUES.LEADS.QUEUE_NAME)
export class LeadsProcessor extends WorkerHost implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(LeadsProcessor.name);
  private initialized = false;

  constructor(
    private readonly sendLeadUseCase: SendLeadUseCase,
    @Inject(leadsWorkerConfig.KEY) private readonly config: LeadsWorkerConfig,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.concurrency = this.config.concurrency;
    this.initialized = true;
  }

  async beforeApplicationShutdown(): Promise<void> {
    // Prisma закрывается в следующей фазе, после завершения активных задач.
    if (this.initialized) {
      await this.worker.close();
    }
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
      if (!this.isRetryable(error)) {
        throw new UnrecoverableError(message);
      }
      throw new Error(message, { cause: error });
    }
  }

  /**
   * Повторяемость читается из контракта LeadDeliveryException: воркер не знает
   * вендорских SDK адаптеров. Неизвестная ошибка остаётся повторяемой,
   * чтобы новая ошибка не приводила к потере доставки.
   */
  private isRetryable(error: unknown): boolean {
    if (error instanceof UnsupportedLeadChannelException) {
      return false;
    }
    if (error instanceof LeadDeliveryException) {
      return error.isRetryable;
    }

    return true;
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
