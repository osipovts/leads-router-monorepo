import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { EnqueueFailedException } from '../exceptions/enqueue-failed.exception';
import { QUEUE_PORT, QueuePort } from '../ports/queue.port';

@Injectable()
export class BroadcastLeadUseCase {
  private readonly logger = new Logger(BroadcastLeadUseCase.name);

  constructor(@Inject(QUEUE_PORT) private readonly queue: QueuePort) {}

  async execute(lead: LeadEntity): Promise<void> {
    const allChannels = Object.values(ChannelEnum);

    this.logger.log(`Broadcasting lead ${lead.id} to ${allChannels.join(', ')}`);
    const results = await Promise.allSettled(
      allChannels.map((channel): Promise<void> => this.queue.sendLead(channel, lead)),
    );

    const failedChannels = allChannels.filter((_, index) => results[index].status === 'rejected');

    if (failedChannels.length > 0) {
      throw new EnqueueFailedException(lead.id, failedChannels);
    }
  }
}
