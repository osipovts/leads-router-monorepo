import type { LeadEntity } from '@leads-router/common';
import { ChannelEnum } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { consoleLeadDeliveryConfig, type ConsoleLeadDeliveryConfigType } from './console-lead-delivery.config';

@Injectable()
export class ConsoleLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.CONSOLE;
  private readonly logger = new Logger(ConsoleLeadDeliveryAdapter.name);

  constructor(@Inject(consoleLeadDeliveryConfig.KEY) private readonly config: ConsoleLeadDeliveryConfigType) {}

  get enabled(): boolean {
    return this.config.ENABLED;
  }

  async send(lead: LeadEntity): Promise<void> {
    this.logger.log(`Incoming lead: ${JSON.stringify(lead)}`);
    return Promise.resolve();
  }
}
