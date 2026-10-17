import { Inject, Logger } from '@nestjs/common';
import { Bot } from 'node-telegram-bot-api';

import { telegramClientConfig, type TelegramClientConfigType } from './telegram-client.config';

export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);
  private _bot: Bot | undefined;

  constructor(@Inject(telegramClientConfig.KEY) private readonly config: TelegramClientConfigType) {}

  // NestJS создаёт клиент и при отключённой доставке, когда токен может отсутствовать.
  // Bot проверяет токен в конструкторе, поэтому создаётся при первом вызове sendMessage.
  private get bot(): Bot {
    this._bot ??= new Bot(this.config.token, { timeoutMs: 10_000 });
    return this._bot;
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
