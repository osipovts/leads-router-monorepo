import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { EmailClient } from './email-client/email.client';
import { emailLeadDeliveryConfig, type EmailLeadDeliveryConfigType } from './email-lead-delivery.config';

@Injectable()
export class EmailLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.EMAIL;
  private readonly logger = new Logger(EmailLeadDeliveryAdapter.name);

  constructor(
    @Inject(emailLeadDeliveryConfig.KEY) private readonly config: EmailLeadDeliveryConfigType,
    private readonly client: EmailClient,
  ) {}

  get enabled(): boolean {
    return this.config.ENABLED;
  }

  async send(lead: LeadEntity): Promise<void> {
    const subject = `New lead from ${lead.name}`;

    await this.client.sendMail(this.config.TO, subject, lead.toString());
    this.logger.log(`Lead from ${lead.name} <${lead.contact}> sent to ${this.config.TO}`);
  }
}
