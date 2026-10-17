import { ChannelEnum, type LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueuePort } from '../../application/ports/queue.port';
import { leadsQueueConfig, type LeadsQueueConfigType } from '../../leads.config';
import { QueueUnavailableException } from './queue-unavailable.exception';

@Injectable()
export class BullmqQueueService implements QueuePort {
  private readonly logger = new Logger(BullmqQueueService.name);

  constructor(
    @InjectQueue(QUEUES.LEADS.QUEUE_NAME) private readonly leadsQueue: Queue,
    @Inject(leadsQueueConfig.KEY) private readonly config: LeadsQueueConfigType,
  ) {}

  async sendLead(channel: ChannelEnum, lead: LeadEntity, attempts: number, backoff: number): Promise<void> {
    try {
      const jobName = QUEUES.LEADS.JOBS.SEND;
      const job: SendLeadJob = { channel, lead };
      // Ретеншн обязателен: без него BullMQ хранит завершённые/проваленные джобы вечно.
      // age задаётся в секундах, чистка ленивая - выполняется при завершении следующих джоб
      const options = {
        attempts,
        backoff,
        removeOnComplete: { age: Math.trunc(this.config.completedRetentionMs / 1_000) },
        removeOnFail: { age: Math.trunc(this.config.failedRetentionMs / 1_000) },
      };

      await this.leadsQueue.add(jobName, job, options);
    } catch (error: unknown) {
      this.logger.error({ lead, error });
      throw new QueueUnavailableException();
    }
  }
}
