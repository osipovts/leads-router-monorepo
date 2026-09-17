import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const httpClientConfigSchema = z.object({
  HTTP_CLIENT_TIMEOUT: z.coerce.number().int().min(1).max(600_000),
  HTTP_CLIENT_RETRY_COUNT: z.coerce.number().int().min(1).max(1_000),
});

const HTTP_CLIENT_CONFIG = 'HTTP_CLIENT_CONFIG';

export const httpClientConfig = registerAs(HTTP_CLIENT_CONFIG, () => {
  const env = httpClientConfigSchema.parse(process.env);

  return {
    timeout: env.HTTP_CLIENT_TIMEOUT,
    retryCount: env.HTTP_CLIENT_RETRY_COUNT,
  };
});

export type HttpClientConfigType = ConfigType<typeof httpClientConfig>;
