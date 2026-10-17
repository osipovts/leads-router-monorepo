import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { leadsQueueConfig, LeadsQueueConfigType } from '../../leads.config';
import { EnqueueFailedException } from '../exceptions/enqueue-failed.exception';
import { LEAD_DEDUPLICATION_PORT, type LeadDeduplicationPort } from '../ports/lead-deduplication.port';
import { QUEUE_PORT, QueuePort } from '../ports/queue.port';

@Injectable()
export class BroadcastLeadUseCase {
  private readonly logger = new Logger(BroadcastLeadUseCase.name);

  constructor(
    @Inject(leadsQueueConfig.KEY) private readonly config: LeadsQueueConfigType,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
    @Inject(LEAD_DEDUPLICATION_PORT) private readonly deduplication: LeadDeduplicationPort,
  ) {}

  async execute(lead: LeadEntity): Promise<void> {
    const firstSeen = await this.deduplication.tryAcquire(lead.id);

    if (!firstSeen) {
      this.logger.warn(`Duplicate lead ${lead.id} from ${lead.contact}, skipping broadcast`);
      return;
    }

    const { attempts, backoff } = this.config;
    const allChannels = Object.values(ChannelEnum);

    this.logger.log(`Broadcasting lead from ${lead.name} <${lead.contact}> to ${allChannels.join(', ')}`);
    const sendLead = (channel: ChannelEnum) => this.queue.sendLead(channel, lead, attempts, backoff);

    const results = await Promise.allSettled(allChannels.map((channel) => sendLead(channel)));

    const failedChannels = allChannels.filter((_, index) => results[index].status === 'rejected');

    if (failedChannels.length > 0) {
      // Частичная неудача: снимаем маркер, иначе повтор запроса с тем же id
      // посчитается дублем и недоставленные каналы не получат лид вовсе
      await this.deduplication.release(lead.id);
      throw new EnqueueFailedException(failedChannels);
    }
  }
}
