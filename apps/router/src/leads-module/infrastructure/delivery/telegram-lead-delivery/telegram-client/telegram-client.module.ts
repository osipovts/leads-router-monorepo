import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TelegramClient } from './telegram.client';
import { telegramClientConfig } from './telegram-client.config';

@Module({
  imports: [ConfigModule.forFeature(telegramClientConfig)],
  providers: [TelegramClient],
  exports: [TelegramClient],
})
export class TelegramClientModule {}
