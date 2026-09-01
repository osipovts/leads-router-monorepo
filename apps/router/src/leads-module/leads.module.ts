import type { ChannelEnum } from '@leads-router/common';
import { QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import type { LeadDeliveryPort } from './application/ports/lead-delivery.port';
import { LEAD_DELIVERY_ADAPTERS } from './application/ports/lead-delivery.port';
import { SendLeadUseCase } from './application/use-cases/send-lead.use-case';
import { ConsoleLeadDeliveryAdapter } from './infrastructure/delivery/console-lead-delivery.adapter';
import { LeadsProcessor } from './presentation/queue/leads.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME })],
  providers: [
    ConsoleLeadDeliveryAdapter,
    {
      provide: LEAD_DELIVERY_ADAPTERS,
      inject: [ConsoleLeadDeliveryAdapter],
      useFactory: (consoleAdapter: ConsoleLeadDeliveryAdapter): ReadonlyMap<ChannelEnum, LeadDeliveryPort> =>
        new Map([[consoleAdapter.channel, consoleAdapter]]),
    },
    SendLeadUseCase,
    LeadsProcessor,
  ],
})
export class LeadsModule {}
