import { ChannelEnum, LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { leadsQueueConfig, LeadsQueueConfigType } from '../../leads.config';
import { QUEUE_PORT, QueuePort } from '../ports/queue.port';

@Injectable()
export class BroadcastLeadUseCase {
  private readonly logger = new Logger(BroadcastLeadUseCase.name);

  constructor(
    @Inject(leadsQueueConfig.KEY) private readonly config: LeadsQueueConfigType,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  async execute(lead: LeadEntity): Promise<void> {
    const { attempts, backoff } = this.config;
    const allChannels = Object.values(ChannelEnum);

    this.logger.log(`Broadcasting lead from ${lead.name} <${lead.contact}> to ${allChannels.join(', ')}`);
    const sendLead = (channel: ChannelEnum) => this.queue.sendLead(channel, lead, attempts, backoff);

    await Promise.allSettled(allChannels.map((channel) => sendLead(channel)));
  }
}
