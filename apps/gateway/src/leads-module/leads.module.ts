import { QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { QUEUE_PORT } from './application/ports/queue.port';
import { CreateLeadUseCase } from './application/use-cases/create-lead.use-case';
import { BullmqQueueService } from './infrastructure/queue/bullmq-queue.service';
import { leadsQueueConfig } from './leads.config';
import { LeadsController } from './presentation/http/leads.controller';

@Module({
  imports: [ConfigModule.forFeature(leadsQueueConfig), BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME })],
  controllers: [LeadsController],
  providers: [CreateLeadUseCase, { provide: QUEUE_PORT, useClass: BullmqQueueService }],
})
export class LeadsModule {}
