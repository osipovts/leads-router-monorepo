import { ChannelEnum, LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Bot } from 'node-telegram-bot-api';

import { LeadDeliveryPort } from '../../application/ports/lead-delivery.port';
import { telegramConfig, TelegramConfigType } from './telegram.config';

@Injectable()
export class TelegramLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.TELEGRAM;
  private readonly bot: Bot;
  private readonly logger = new Logger(TelegramLeadDeliveryAdapter.name);

  constructor(@Inject(telegramConfig.KEY) private readonly config: TelegramConfigType) {
    this.bot = new Bot(this.config.token);
  }

  async send(lead: LeadEntity): Promise<void> {
    try {
      await this.bot.api.sendMessage({ chat_id: this.config.chatId, text: lead.toString() });
      this.logger.log(`Lead from ${lead.name} <${lead.contact}> sent to telegram chat ${this.config.chatId}`);
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }
}
