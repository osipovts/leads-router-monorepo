import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const leadsWorkerConfigSchema = z.object({
  LEADS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  // Файл пульса воркера для healthcheck контейнера (см. WorkerHeartbeat)
  LEADS_WORKER_HEARTBEAT_FILE: z.string().trim().min(1).default('/tmp/router-heartbeat'),
});

const LEADS_WORKER_CONFIG = 'LEADS_WORKER_CONFIG';

export const leadsWorkerConfig = registerAs(LEADS_WORKER_CONFIG, () => {
  const env = leadsWorkerConfigSchema.parse(process.env);

  return { concurrency: env.LEADS_WORKER_CONCURRENCY, heartbeatFile: env.LEADS_WORKER_HEARTBEAT_FILE };
});

export type LeadsWorkerConfigType = ConfigType<typeof leadsWorkerConfig>;
