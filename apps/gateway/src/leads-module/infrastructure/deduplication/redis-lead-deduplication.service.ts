import { bullmqConfig, type BullmqConfigType } from '@leads-router/common';
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { LeadDeduplicationPort } from '../../application/ports/lead-deduplication.port';
import { leadsDeduplicationConfig, type LeadsDeduplicationConfigType } from '../../leads.config';
import { DeduplicationUnavailableException } from './deduplication-unavailable.exception';

@Injectable()
export class RedisLeadDeduplicationService implements LeadDeduplicationPort, OnModuleDestroy {
  private readonly logger = new Logger(RedisLeadDeduplicationService.name);
  private readonly client: Redis;
  private readonly ttlSeconds: number;

  constructor(
    @Inject(bullmqConfig.KEY) connection: BullmqConfigType,
    @Inject(leadsDeduplicationConfig.KEY) config: LeadsDeduplicationConfigType,
  ) {
    // Дедупликация живёт в том же Redis, что и очередь, но на отдельном соединении:
    // смешивать обычные команды с соединением BullMQ небезопасно
    this.client = new Redis({
      host: connection.connection.host,
      port: connection.connection.port,
      password: connection.connection.password,
    });
    this.ttlSeconds = Math.trunc(config.ttlMs / 1_000);
  }

  async tryAcquire(id: string): Promise<boolean> {
    try {
      const result = await this.client.set(this.key(id), '1', 'EX', this.ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error: unknown) {
      this.logger.error({ id, error });
      throw new DeduplicationUnavailableException();
    }
  }

  async release(id: string): Promise<void> {
    try {
      await this.client.del(this.key(id));
    } catch (error: unknown) {
      // Best-effort: повтор запроса может быть лишним, но это не теряет лид -
      // каналы, куда он встал, его доставят
      this.logger.error({ id, error });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  private key(id: string): string {
    return `leads:dedupe:${id}`;
  }
}
