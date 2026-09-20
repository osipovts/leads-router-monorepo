import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TelegramClientModule } from './telegram-client/telegram-client.module';
import { TelegramLeadDeliveryAdapter } from './telegram-lead-delivery.adapter';
import { telegramLeadDeliveryConfig } from './telegram-lead-delivery.config';

@Module({
  imports: [ConfigModule.forFeature(telegramLeadDeliveryConfig), TelegramClientModule],
  providers: [TelegramLeadDeliveryAdapter],
  exports: [TelegramLeadDeliveryAdapter],
})
export class TelegramLeadDeliveryModule {}
