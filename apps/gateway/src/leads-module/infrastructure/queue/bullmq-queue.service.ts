import { ChannelEnum, LeadEntity, QUEUES, SendLeadJob } from '@leads-router/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueuePort } from '../../application/ports/queue.port';
import { QueueUnavailableException } from './queue-unavailable.exception';

@Injectable()
export class BullmqQueueService implements QueuePort {
  private readonly logger = new Logger(BullmqQueueService.name);

  constructor(@InjectQueue(QUEUES.LEADS.QUEUE_NAME) private readonly leadsQueue: Queue) {}

  async sendLead(channel: ChannelEnum, lead: LeadEntity, attempts: number, backoff: number): Promise<void> {
    try {
      const jobName = QUEUES.LEADS.JOBS.SEND;
      const job: SendLeadJob = { channel, lead };
      const options = { attempts, backoff };

      await this.leadsQueue.add(jobName, job, options);
    } catch (error: unknown) {
      this.logger.error({ lead, error });
      throw new QueueUnavailableException();
    }
  }
}
