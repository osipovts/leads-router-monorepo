import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { TelegramClient } from './telegram-client/telegram.client';
import { telegramLeadDeliveryConfig, type TelegramLeadDeliveryConfigType } from './telegram-lead-delivery.config';

@Injectable()
export class TelegramLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.TELEGRAM;
  private readonly logger = new Logger(TelegramLeadDeliveryAdapter.name);

  constructor(
    @Inject(telegramLeadDeliveryConfig.KEY) private readonly config: TelegramLeadDeliveryConfigType,
    private readonly client: TelegramClient,
  ) {}

  get enabled(): boolean {
    return this.config.ENABLED;
  }

  async send(lead: LeadEntity): Promise<void> {
    await this.client.sendMessage(this.config.CHAT_ID, lead.toString());
    this.logger.log(`Lead from ${lead.name} <${lead.contact}> sent to telegram chat ${this.config.CHAT_ID}`);
  }
}
