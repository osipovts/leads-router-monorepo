import { bullmqConfig, QUEUES } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LEAD_DEDUPLICATION_PORT } from './application/ports/lead-deduplication.port';
import { QUEUE_PORT } from './application/ports/queue.port';
import { BroadcastLeadUseCase } from './application/use-cases/broadcast-lead.use-case';
import { RedisLeadDeduplicationService } from './infrastructure/deduplication/redis-lead-deduplication.service';
import { BullmqQueueService } from './infrastructure/queue/bullmq-queue.service';
import { leadsDeduplicationConfig, leadsQueueConfig } from './leads.config';
import { BroadcastLeadsController } from './presentation/http/broadcast-leads.controller';

@Module({
  imports: [
    ConfigModule.forFeature(bullmqConfig),
    ConfigModule.forFeature(leadsQueueConfig),
    ConfigModule.forFeature(leadsDeduplicationConfig),
    BullModule.registerQueue({ name: QUEUES.LEADS.QUEUE_NAME }),
  ],
  controllers: [BroadcastLeadsController],
  providers: [
    BroadcastLeadUseCase,
    { provide: QUEUE_PORT, useClass: BullmqQueueService },
    { provide: LEAD_DEDUPLICATION_PORT, useClass: RedisLeadDeduplicationService },
  ],
})
export class LeadsModule {}
