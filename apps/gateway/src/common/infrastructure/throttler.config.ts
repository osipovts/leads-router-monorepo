import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const throttlerConfigSchema = z.object({
  THROTTLE_TTL_MS: z.coerce.number().int().min(1_000).default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
});

const THROTTLER_CONFIG = 'THROTTLER_CONFIG';

export const throttlerConfig = registerAs(THROTTLER_CONFIG, () => {
  const env = throttlerConfigSchema.parse(process.env);

  return {
    ttlMs: env.THROTTLE_TTL_MS,
    limit: env.THROTTLE_LIMIT,
  };
});

export type ThrottlerConfigType = ConfigType<typeof throttlerConfig>;
