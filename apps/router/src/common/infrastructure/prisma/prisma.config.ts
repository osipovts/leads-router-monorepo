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
});

const PRISMA_CONFIG = 'PRISMA_CONFIG';

export const prismaConfig = registerAs(PRISMA_CONFIG, () => {
  // Клиент принадлежит database-адаптеру: пока доставка выключена, DATABASE_URL не валидируется
  // и может не задаваться в env (см. контракт isDeliveryEnabled)
  if (!isDeliveryEnabled(process.env.DATABASE_LEAD_DELIVERY_ENABLED)) {
    return { enabled: false, databaseUrl: '' };
  }

  const env = prismaConfigSchema.parse(process.env);

  return { enabled: true, databaseUrl: env.DATABASE_URL };
});

export type PrismaConfigType = ConfigType<typeof prismaConfig>;
