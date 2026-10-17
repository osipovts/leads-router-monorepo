import { registerAs } from '@nestjs/config';
import z from 'zod';

export interface LeadsWorkerConfig {
  concurrency: number;
}

const leadsWorkerConfigSchema = z.object({
  LEADS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
});

export const leadsWorkerConfig = registerAs('LEADS_WORKER_CONFIG', (): LeadsWorkerConfig => {
  const env = leadsWorkerConfigSchema.parse(process.env);
  return { concurrency: env.LEADS_WORKER_CONCURRENCY };
});
