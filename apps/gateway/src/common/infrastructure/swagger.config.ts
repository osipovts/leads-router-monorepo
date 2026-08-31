import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const swaggerConfigSchema = z.object({
  APP_SWAGGER_ENABLE: z.coerce.boolean().default(false),
  APP_SWAGGER_API_DOCS: z.string().trim().min(1).default('api/docs'),
  APP_SWAGGER_API_JSON_DOCS: z.string().trim().min(1).default('api/json-docs'),
});

export const SWAGGER_CONFIG = 'SWAGGER_CONFIG';

export const swaggerConfig = registerAs(SWAGGER_CONFIG, () => {
  const env = swaggerConfigSchema.parse(process.env);

  return {
    isEnabled: env.APP_SWAGGER_ENABLE,
    apiDocs: env.APP_SWAGGER_API_DOCS,
    apiJsonDocs: env.APP_SWAGGER_API_JSON_DOCS,
  };
});

export type SwaggerConfigType = ConfigType<typeof swaggerConfig>;
