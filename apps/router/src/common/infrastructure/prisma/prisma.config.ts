import { isDeliveryEnabled } from '@leads-router/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const prismaConfigSchema = z.object({
  DATABASE_URL: z
    .url('DATABASE_URL must be a valid URL')
    .refine(
      (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      'DATABASE_URL must use the postgresql protocol',
    ),
  // У pg оба таймаута по умолчанию отключены: зависший Postgres надолго занимает слот воркера
  // и блокирует graceful shutdown, поэтому ограничиваются явными значениями (в миллисекундах)
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number().int().min(1).max(600_000).default(10_000),
  DATABASE_STATEMENT_TIMEOUT: z.coerce.number().int().min(1).max(600_000).default(15_000),
});

const PRISMA_CONFIG = 'PRISMA_CONFIG';

export const prismaConfig = registerAs(PRISMA_CONFIG, () => {
  // Клиент принадлежит database-адаптеру: пока доставка выключена, DATABASE_URL не валидируется
  // и может не задаваться в env (см. контракт isDeliveryEnabled)
  if (!isDeliveryEnabled(process.env.DATABASE_LEAD_DELIVERY_ENABLED)) {
    return { enabled: false, databaseUrl: '', connectionTimeout: 0, statementTimeout: 0 };
  }

  const env = prismaConfigSchema.parse(process.env);

  return {
    enabled: true,
    databaseUrl: env.DATABASE_URL,
    connectionTimeout: env.DATABASE_CONNECTION_TIMEOUT,
    statementTimeout: env.DATABASE_STATEMENT_TIMEOUT,
  };
});

export type PrismaConfigType = ConfigType<typeof prismaConfig>;
