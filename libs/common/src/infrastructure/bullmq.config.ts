import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const bullmqConfigSchema = z.object({
  BULLMQ_CONNECTION_HOST: z.string().trim().min(1).default('redis'),
  BULLMQ_CONNECTION_PORT: z.coerce.number().int().min(1).max(65_535),
  BULLMQ_CONNECTION_PASSWORD: z.string().optional(),
});

const BULLMQ_CONFIG = 'BULLMQ_CONFIG';

export const bullmqConfig = registerAs(BULLMQ_CONFIG, () => {
  const env = bullmqConfigSchema.parse(process.env);

  return {
    connection: {
      host: env.BULLMQ_CONNECTION_HOST,
      port: env.BULLMQ_CONNECTION_PORT,
      password: env.BULLMQ_CONNECTION_PASSWORD,
    },
  };
});

export type BullmqConfigType = ConfigType<typeof bullmqConfig>;
