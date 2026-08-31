import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const bullmqConfigSchema = z.object({
  APP_BULLMQ_CONNECTION_HOST: z.string().trim().min(1).default('redis'),
  APP_BULLMQ_CONNECTION_PORT: z.coerce.number().min(1).max(65_535),
  APP_BULLMQ_CONNECTION_PASSWORD: z.string().optional(),
});

export const BULLMQ_CONFIG = 'BULLMQ_CONFIG';

export const bullmqConfig = registerAs(BULLMQ_CONFIG, () => {
  const env = bullmqConfigSchema.parse(process.env);

  return {
    connection: {
      host: env.APP_BULLMQ_CONNECTION_HOST,
      port: env.APP_BULLMQ_CONNECTION_PORT,
      password: env.APP_BULLMQ_CONNECTION_PASSWORD,
    },
  };
});

export type BullmqConfigType = ConfigType<typeof bullmqConfig>;
