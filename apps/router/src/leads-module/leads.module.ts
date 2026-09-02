import type { ChannelEnum } from '@leads-router/common';
import { QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import type { LeadDeliveryPort } from './application/ports/lead-delivery.port';
import { LEAD_DELIVERY_ADAPTERS } from './application/ports/lead-delivery.port';
import { SendLeadUseCase } from './application/use-cases/send-lead.use-case';
import { ConsoleLeadDeliveryAdapter } from './infrastructure/delivery/console-lead-delivery.adapter';
import { telegramConfig } from './infrastructure/delivery/telegram.config';
import { TelegramLeadDeliveryAdapter } from './infrastructure/delivery/telegram-lead-delivery.adapter';
import { LeadsProcessor } from './presentation/queue/leads.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME }), ConfigModule.forFeature(telegramConfig)],
  providers: [
    ConsoleLeadDeliveryAdapter,
    TelegramLeadDeliveryAdapter,
    {
      provide: LEAD_DELIVERY_ADAPTERS,
      inject: [ConsoleLeadDeliveryAdapter, TelegramLeadDeliveryAdapter],
      useFactory: (
        consoleAdapter: ConsoleLeadDeliveryAdapter,
        telegramAdapter: TelegramLeadDeliveryAdapter,
      ): ReadonlyMap<ChannelEnum, LeadDeliveryPort> =>
        new Map<ChannelEnum, LeadDeliveryPort>([
          [consoleAdapter.channel, consoleAdapter],
          [telegramAdapter.channel, telegramAdapter],
        ]),
    },
    SendLeadUseCase,
    LeadsProcessor,
  ],
})
export class LeadsModule {}
