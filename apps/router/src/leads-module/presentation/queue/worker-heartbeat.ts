import { writeFile } from 'node:fs/promises';

import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import { leadsWorkerConfig, type LeadsWorkerConfigType } from '../../leads.config';
import { LeadsProcessor } from './leads.processor';

export const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Пульс воркера для healthcheck контейнера: у router нет HTTP-сервера, поэтому пока воркер
 * работает и подключён к Redis, в файл пишется время последней проверки. Healthcheck
 * считает контейнер здоровым, пока это время свежее.
 */
@Injectable()
export class WorkerHeartbeat implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(WorkerHeartbeat.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(LeadsProcessor) private readonly worker: Pick<LeadsProcessor, 'isHealthy'>,
    @Inject(leadsWorkerConfig.KEY) private readonly config: LeadsWorkerConfigType,
  ) {}

  onApplicationBootstrap(): void {
    void this.beat();
    this.timer = setInterval((): void => {
      void this.beat();
    }, HEARTBEAT_INTERVAL_MS);
    this.timer.unref();
  }

  beforeApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async beat(): Promise<void> {
    if (!this.worker.isHealthy()) {
      return;
    }
    try {
      await writeFile(this.config.heartbeatFile, Date.now().toString());
    } catch (error: unknown) {
      this.logger.warn({ event: 'worker_heartbeat_failed', error: String(error) });
    }
  }
}
