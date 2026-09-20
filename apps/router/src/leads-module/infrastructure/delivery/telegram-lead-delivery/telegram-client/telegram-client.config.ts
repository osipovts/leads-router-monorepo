import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const telegramClientConfigSchema = z.object({
  TELEGRAM_CLIENT_TOKEN: z.string().trim().min(1),
});

const TELEGRAM_CLIENT_CONFIG = 'TELEGRAM_CLIENT_CONFIG';

export const telegramClientConfig = registerAs(TELEGRAM_CLIENT_CONFIG, () => {
  const env = telegramClientConfigSchema.parse(process.env);

  return {
    token: env.TELEGRAM_CLIENT_TOKEN,
  };
});

export type TelegramClientConfigType = ConfigType<typeof telegramClientConfig>;
