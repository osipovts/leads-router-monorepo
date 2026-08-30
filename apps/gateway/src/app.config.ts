import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const appConfigSchema = z.object({
  APP_HOST: z.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  APP_SWAGGER_ENABLE: z.coerce.boolean().default(false),
  APP_SWAGGER_API_DOCS: z.string().trim().min(1).default('api/docs'),
  APP_SWAGGER_API_JSON_DOCS: z.string().trim().min(1).default('api/json-docs'),
  APP_BULLMQ_CONNECTION_HOST: z.string().trim().min(1).default('redis'),
  APP_BULLMQ_CONNECTION_PORT: z.coerce.number().min(1).max(65_535),
  APP_BULLMQ_CONNECTION_PASSWORD: z.string().optional(),
});

export const APP_CONFIG = 'APP_CONFIG';

export const appConfig = registerAs(APP_CONFIG, () => {
  const env = appConfigSchema.parse(process.env);

  return {
    host: env.APP_HOST,
    port: env.APP_PORT,
    swagger: {
      isEnabled: env.APP_SWAGGER_ENABLE,
      apiDocs: env.APP_SWAGGER_API_DOCS,
      apiJsonDocs: env.APP_SWAGGER_API_JSON_DOCS,
    },
    bullmq: {
      connection: {
        host: env.APP_BULLMQ_CONNECTION_HOST,
        port: env.APP_BULLMQ_CONNECTION_PORT,
        password: env.APP_BULLMQ_CONNECTION_PASSWORD,
      },
    },
  };
});

export type AppConfigType = ConfigType<typeof appConfig>;
