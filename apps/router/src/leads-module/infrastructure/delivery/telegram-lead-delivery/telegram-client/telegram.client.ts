import { Inject, Logger } from '@nestjs/common';
import { Bot } from 'node-telegram-bot-api';

import { telegramClientConfig, type TelegramClientConfigType } from './telegram-client.config';

export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);
  private _bot: Bot | undefined;

  constructor(@Inject(telegramClientConfig.KEY) private readonly config: TelegramClientConfigType) {}

  // Бот валидирует токен в конструкторе, а клиент инстанцируется NestJS даже при выключенной
  // доставке (тогда токен по контракту isDeliveryEnabled может отсутствовать в env), поэтому
  // создаётся лениво — при первом реальном sendMessage
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
