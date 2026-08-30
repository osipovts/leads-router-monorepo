import { QUEUES } from '@leads-router/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueuePort } from '../../application/ports/queue.port';
import { LeadDto } from '../../presentation/http/dto/lead.dto';
import { QueueUnavailableException } from './queue-unavailable.exception';

@Injectable()
export class BullmqQueueService implements QueuePort {
  private readonly logger = new Logger(BullmqQueueService.name);

  constructor(@InjectQueue(QUEUES.LEADS.QUEUE_NAME) private readonly leadsQueue: Queue) {}

  async createLead(lead: LeadDto, attempts: number, backoff: number): Promise<LeadDto> {
    try {
      await this.leadsQueue.add(QUEUES.LEADS.JOBS.CREATE, lead, { attempts, backoff });
      return lead;
    } catch (error: unknown) {
      this.logger.error({ lead, error });
      throw new QueueUnavailableException();
    }
  }
}
