import { ChannelEnum, LeadEntity } from '@leads-router/common';
import { Inject, Injectable } from '@nestjs/common';

import { leadsQueueConfig, LeadsQueueConfigType } from '../../leads.config';
import { QUEUE_PORT, QueuePort } from '../ports/queue.port';

@Injectable()
export class BroadcastLeadUseCase {
  constructor(
    @Inject(leadsQueueConfig.KEY) private readonly config: LeadsQueueConfigType,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  async execute(lead: LeadEntity): Promise<void> {
    const { attempts, backoff } = this.config.leads.queue;
    const allChannels = Object.values(ChannelEnum);
    const sendLead = (channel: ChannelEnum) => this.queue.sendLead(channel, lead, attempts, backoff);

    await Promise.allSettled(allChannels.map((channel) => sendLead(channel)));
  }
}
