import { QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SendLeadUseCase } from './application/use-cases/send-lead.use-case';
import {
  DELIVERY_ADAPTER_MODULES,
  LEAD_DELIVERY_ADAPTERS_PROVIDER,
} from './infrastructure/delivery/delivery.providers';
import { leadsWorkerConfig } from './leads.config';
import { LeadsProcessor } from './presentation/queue/leads.processor';

@Module({
  imports: [
    ConfigModule.forFeature(leadsWorkerConfig),
    BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME }),
    ...DELIVERY_ADAPTER_MODULES,
  ],
  providers: [LEAD_DELIVERY_ADAPTERS_PROVIDER, SendLeadUseCase, LeadsProcessor],
})
export class LeadsModule {}
