import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const prismaConfigSchema = z.object({
  DATABASE_URL: z
    .url('DATABASE_URL must be a valid URL')
    .refine(
      (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      'DATABASE_URL must use the postgresql protocol',
    ),
});

export const prismaConfig = registerAs('prisma', () => {
  const env = prismaConfigSchema.parse(process.env);

  return { databaseUrl: env.DATABASE_URL };
});

export type PrismaConfigType = ConfigType<typeof prismaConfig>;
