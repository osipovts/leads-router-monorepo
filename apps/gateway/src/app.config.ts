import type { LogLevel } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const APP_LOGGER_LEVELS = ['debug', 'verbose', 'log', 'warn', 'error'] as const;

type AppLoggerLevel = (typeof APP_LOGGER_LEVELS)[number];

// Выбранный уровень включает все более приоритетные; debug — самый подробный
const LEVELS_FROM: Record<AppLoggerLevel, LogLevel[]> = {
  debug: ['debug', 'verbose', 'log', 'warn', 'error'],
  verbose: ['verbose', 'log', 'warn', 'error'],
  log: ['log', 'warn', 'error'],
  warn: ['warn', 'error'],
  error: ['error'],
};

const appConfigSchema = z.object({
  APP_HOST: z.string().trim().min(1).default('0.0.0.0'),
  APP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  APP_TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  APP_LOGGER_LEVEL: z.enum(APP_LOGGER_LEVELS).default('log'),
});

export const APP_CONFIG = 'APP_CONFIG';

export const appConfig = registerAs(APP_CONFIG, () => {
  const env = appConfigSchema.parse(process.env);

  return {
    host: env.APP_HOST,
    port: env.APP_PORT,
    trustProxyHops: env.APP_TRUST_PROXY_HOPS,
    loggerLevels: LEVELS_FROM[env.APP_LOGGER_LEVEL],
  };
});

export type AppConfigType = ConfigType<typeof appConfig>;
