import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const telegramConfigSchema = z.object({
  TELEGRAM_TOKEN: z.string().trim().min(1),
  TELEGRAM_CHAT_ID: z.string().trim().min(1),
});

export const TELEGRAM_CONFIG = 'TELEGRAM_CONFIG';

export const telegramConfig = registerAs(TELEGRAM_CONFIG, () => {
  const env = telegramConfigSchema.parse(process.env);

  return {
    token: env.TELEGRAM_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
  };
});

export type TelegramConfigType = ConfigType<typeof telegramConfig>;
