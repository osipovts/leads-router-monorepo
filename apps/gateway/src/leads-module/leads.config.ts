import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const LEADS_QUEUE_CONFIG = 'LEADS_QUEUE_CONFIG';

const leadsConfigSchema = z.object({
  LEADS_QUEUE_ATTEMPTS: z.coerce.number().int().min(1).default(8),
  LEADS_QUEUE_BACKOFF: z.coerce.number().int().min(1).default(5_000),
  LEADS_QUEUE_COMPLETED_RETENTION_MS: z.coerce.number().int().min(1_000).default(3_600_000),
  LEADS_QUEUE_FAILED_RETENTION_MS: z.coerce.number().int().min(1_000).default(2_592_000_000),
});

export const leadsQueueConfig = registerAs(LEADS_QUEUE_CONFIG, () => {
  const env = leadsConfigSchema.parse(process.env);

  return {
    attempts: env.LEADS_QUEUE_ATTEMPTS,
    backoff: env.LEADS_QUEUE_BACKOFF,
    completedRetentionMs: env.LEADS_QUEUE_COMPLETED_RETENTION_MS,
    failedRetentionMs: env.LEADS_QUEUE_FAILED_RETENTION_MS,
  };
});

export type LeadsQueueConfigType = ConfigType<typeof leadsQueueConfig>;

const leadsDeduplicationConfigSchema = z.object({
  LEADS_DEDUPLICATION_TTL_MS: z.coerce.number().int().min(1_000).default(86_400_000),
});

const LEADS_DEDUPLICATION_CONFIG = 'LEADS_DEDUPLICATION_CONFIG';

export const leadsDeduplicationConfig = registerAs(LEADS_DEDUPLICATION_CONFIG, () => {
  const env = leadsDeduplicationConfigSchema.parse(process.env);

  return { ttlMs: env.LEADS_DEDUPLICATION_TTL_MS };
});

export type LeadsDeduplicationConfigType = ConfigType<typeof leadsDeduplicationConfig>;
