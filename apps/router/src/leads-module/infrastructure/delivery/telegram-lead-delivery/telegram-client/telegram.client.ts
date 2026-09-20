import { Inject, Logger } from '@nestjs/common';
import { Bot } from 'node-telegram-bot-api';

import { telegramClientConfig, type TelegramClientConfigType } from './telegram-client.config';

export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);
  private readonly bot: Bot;

  constructor(@Inject(telegramClientConfig.KEY) config: TelegramClientConfigType) {
    this.bot = new Bot(config.token);
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage({ chat_id: chatId, text });
    } catch (error: unknown) {
      this.logger.error(error);
      throw error;
    }
  }
}
