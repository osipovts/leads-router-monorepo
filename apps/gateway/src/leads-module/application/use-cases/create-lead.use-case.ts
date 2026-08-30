import { Inject, Injectable } from '@nestjs/common';

import { LeadEntityInterface } from '../../domain/lead.entity';
import { leadsQueueConfig, LeadsQueueConfigType } from '../../leads.config';
import { QUEUE_PORT, QueuePort } from '../ports/queue.port';

@Injectable()
export class CreateLeadUseCase {
  constructor(
    @Inject(leadsQueueConfig.KEY) private readonly config: LeadsQueueConfigType,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  async execute(lead: LeadEntityInterface): Promise<LeadEntityInterface> {
    const { attempts, backoff } = this.config.leads.queue;
    return this.queue.createLead(lead, attempts, backoff);
  }
}
