import { isDeliveryEnabled } from '@leads-router/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const telegramClientConfigSchema = z.object({
  TELEGRAM_CLIENT_TOKEN: z.string().trim().min(1),
});

const TELEGRAM_CLIENT_CONFIG = 'TELEGRAM_CLIENT_CONFIG';

export const telegramClientConfig = registerAs(TELEGRAM_CLIENT_CONFIG, () => {
  // Клиент принадлежит telegram-адаптеру: пока доставка выключена, токен не валидируется
  // и может не задаваться в env (см. контракт isDeliveryEnabled)
  if (!isDeliveryEnabled(process.env.TELEGRAM_LEAD_DELIVERY_ENABLED)) {
    return { token: '' };
  }

  const env = telegramClientConfigSchema.parse(process.env);

  return {
    token: env.TELEGRAM_CLIENT_TOKEN,
  };
});

export type TelegramClientConfigType = ConfigType<typeof telegramClientConfig>;
