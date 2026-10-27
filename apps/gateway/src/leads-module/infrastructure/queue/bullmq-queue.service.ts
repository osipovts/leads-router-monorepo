import { ChannelEnum, type LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueuePort } from '../../application/ports/queue.port';
import {
  leadsDeduplicationConfig,
  type LeadsDeduplicationConfigType,
  leadsQueueConfig,
  type LeadsQueueConfigType,
} from '../../leads.config';
import { QueueUnavailableException } from './queue-unavailable.exception';

@Injectable()
export class BullmqQueueService implements QueuePort {
  private readonly logger = new Logger(BullmqQueueService.name);

  constructor(
    @InjectQueue(QUEUES.LEADS.QUEUE_NAME) private readonly leadsQueue: Queue<SendLeadJob>,
    @Inject(leadsQueueConfig.KEY) private readonly config: LeadsQueueConfigType,
    @Inject(leadsDeduplicationConfig.KEY) private readonly deduplicationConfig: LeadsDeduplicationConfigType,
  ) {
    this.leadsQueue.on('error', (error: Error): void => {
      this.logger.error({ event: 'leads_queue_error', error: error.name, message: error.message });
    });
  }

  isReady(): boolean {
    return this.leadsQueue.getBackend().connection.status === 'ready';
  }

  async sendLead(channel: ChannelEnum, lead: LeadEntity): Promise<void> {
    // До первого подключения BullMQ может ждать Redis без ограничения времени.
    if (!this.isReady()) {
      // Штатная деградация, а не сбой: ошибки соединения уже логируются слушателем 'error'
      // очереди, а итог запроса — exception-фильтром. Без этого ограничения broadcast
      // в 5 каналов давал бы 6 error-логов на каждый отклонённый запрос
      this.logger.debug({ channel, leadId: lead.id, event: 'queue_not_ready' });
      throw new QueueUnavailableException();
    }

    try {
      const jobName = QUEUES.LEADS.JOBS.SEND;
      const job: SendLeadJob = { channel, lead };
      const options = {
        attempts: this.config.attempts,
        backoff: { type: QUEUES.LEADS.BACKOFF_STRATEGY, delay: this.config.backoff },
        // BullMQ создаёт маркер вместе с задачей. Повтор не продлевает окно дедупликации.
        deduplication: { id: `${lead.id.toLowerCase()}-${channel}`, ttl: this.deduplicationConfig.ttlMs },
        // age задаётся в секундах; BullMQ удаляет старые задачи при завершении следующих.
        removeOnComplete: { age: Math.trunc(this.config.completedRetentionMs / 1_000) },
        removeOnFail: { age: Math.trunc(this.config.failedRetentionMs / 1_000) },
      };

      await this.leadsQueue.add(jobName, job, options);
    } catch (error: unknown) {
      // Данные лида не записываются в лог: contact и message могут содержать персональные данные.
      this.logger.error({ channel, leadId: lead.id, error });
      throw new QueueUnavailableException();
    }
  }
}
