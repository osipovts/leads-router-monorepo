import { QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { QUEUE_PORT } from './application/ports/queue.port';
import { BroadcastLeadUseCase } from './application/use-cases/broadcast-lead.use-case';
import { BullmqQueueService } from './infrastructure/queue/bullmq-queue.service';
import { leadsQueueConfig } from './leads.config';
import { BroadcastLeadsController } from './presentation/http/broadcast-leads.controller';

@Module({
  imports: [ConfigModule.forFeature(leadsQueueConfig), BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME })],
  controllers: [BroadcastLeadsController],
  providers: [BroadcastLeadUseCase, { provide: QUEUE_PORT, useClass: BullmqQueueService }],
})
export class LeadsModule {}
