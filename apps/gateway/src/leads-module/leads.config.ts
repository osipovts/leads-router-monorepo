import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const LEADS_QUEUE_CONFIG = 'LEADS_QUEUE_CONFIG';

const leadsConfigSchema = z.object({
  LEADS_QUEUE_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  LEADS_QUEUE_BACKOFF: z.coerce.number().int().min(1).default(5_000),
});

export const leadsQueueConfig = registerAs(LEADS_QUEUE_CONFIG, () => {
  const env = leadsConfigSchema.parse(process.env);

  return {
    leads: {
      queue: {
        attempts: env.LEADS_QUEUE_ATTEMPTS,
        backoff: env.LEADS_QUEUE_BACKOFF,
      },
    },
  };
});

export type LeadsQueueConfigType = ConfigType<typeof leadsQueueConfig>;
