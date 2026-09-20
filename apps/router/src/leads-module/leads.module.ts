import type { ChannelEnum } from '@leads-router/common';
import { QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import type { LeadDeliveryPort } from './application/ports/lead-delivery.port';
import { LEAD_DELIVERY_ADAPTERS } from './application/ports/lead-delivery.port';
import { SendLeadUseCase } from './application/use-cases/send-lead.use-case';
import { ConsoleLeadDeliveryAdapter } from './infrastructure/delivery/console-lead-delivery/console-lead-delivery.adapter';
import { ConsoleLeadDeliveryModule } from './infrastructure/delivery/console-lead-delivery/console-lead-delivery.module';
import { DatabaseLeadDeliveryAdapter } from './infrastructure/delivery/database-lead-delivery/database-lead-delivery.adapter';
import { DatabaseLeadDeliveryModule } from './infrastructure/delivery/database-lead-delivery/database-lead-delivery.module';
import { HttpLeadDeliveryAdapter } from './infrastructure/delivery/http-lead-delivery/http-lead-delivery.adapter';
import { HttpLeadDeliveryModule } from './infrastructure/delivery/http-lead-delivery/http-lead-delivery.module';
import { TelegramLeadDeliveryAdapter } from './infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.adapter';
import { TelegramLeadDeliveryModule } from './infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.module';
import { LeadsProcessor } from './presentation/queue/leads.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME }),
    ConsoleLeadDeliveryModule,
    DatabaseLeadDeliveryModule,
    TelegramLeadDeliveryModule,
    HttpLeadDeliveryModule,
  ],
  providers: [
    {
      provide: LEAD_DELIVERY_ADAPTERS,
      inject: [
        ConsoleLeadDeliveryAdapter,
        DatabaseLeadDeliveryAdapter,
        TelegramLeadDeliveryAdapter,
        HttpLeadDeliveryAdapter,
      ],
      useFactory: (...adapters: LeadDeliveryPort[]): ReadonlyMap<ChannelEnum, LeadDeliveryPort> =>
        new Map(
          adapters
            .filter((adapter) => adapter.enabled)
            .map((adapter) => [adapter.channel, adapter] as const),
        ),
    },
    SendLeadUseCase,
    LeadsProcessor,
  ],
})
export class LeadsModule {}
