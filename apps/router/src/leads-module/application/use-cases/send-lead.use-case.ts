import type { ChannelEnum, LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { UnsupportedLeadChannelException } from '../exceptions/unsupported-lead-channel.exception';
import { LEAD_DELIVERY_ADAPTERS, LeadDeliveryPort } from '../ports/lead-delivery.port';

@Injectable()
export class SendLeadUseCase {
  private readonly logger = new Logger(SendLeadUseCase.name);

  constructor(
    @Inject(LEAD_DELIVERY_ADAPTERS)
    private readonly deliveryAdapters: ReadonlyMap<ChannelEnum, LeadDeliveryPort>,
  ) {}

  async execute(channel: ChannelEnum, lead: LeadEntity): Promise<void> {
    const adapter = this.deliveryAdapters.get(channel);

    if (adapter === undefined) {
      throw new UnsupportedLeadChannelException(channel);
    }

    if (!adapter.enabled) {
      this.logger.warn(`Lead delivery adapter for channel '${channel}' is disabled, skipping lead`);
      return;
    }

    return adapter.send(lead);
  }
}
