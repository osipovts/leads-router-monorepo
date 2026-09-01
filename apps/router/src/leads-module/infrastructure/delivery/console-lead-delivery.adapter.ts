import type { LeadEntity } from '@leads-router/common';
import { ChannelEnum } from '@leads-router/common';
import { Injectable, Logger } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../application/ports/lead-delivery.port';

@Injectable()
export class ConsoleLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.CONSOLE;
  private readonly logger = new Logger(ConsoleLeadDeliveryAdapter.name);

  send(lead: LeadEntity): Promise<void> {
    this.logger.log(`Incoming lead: ${JSON.stringify(lead)}`);
    return Promise.resolve();
  }
}
