import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const appConfigSchema = z.object({
  APP_HOST: z.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

export const APP_CONFIG = 'APP_CONFIG';

export const appConfig = registerAs(APP_CONFIG, () => {
  const env = appConfigSchema.parse(process.env);

  return {
    host: env.APP_HOST,
    port: env.APP_PORT,
  };
});

export type AppConfigType = ConfigType<typeof appConfig>;
