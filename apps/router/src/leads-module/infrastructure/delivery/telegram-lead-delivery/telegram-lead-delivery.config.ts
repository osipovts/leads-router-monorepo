import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const telegramLeadDeliveryConfigSchema = z.object({
  TELEGRAM_LEAD_DELIVERY_ENABLED: z.stringbool(),
  TELEGRAM_LEAD_DELIVERY_CHAT_ID: z.string().trim().min(1),
});

const TELEGRAM_LEAD_DELIVERY_CONFIG = 'TELEGRAM_LEAD_DELIVERY_CONFIG';

export const telegramLeadDeliveryConfig = registerAs(TELEGRAM_LEAD_DELIVERY_CONFIG, () => {
  const env = telegramLeadDeliveryConfigSchema.parse(process.env);

  return {
    ENABLED: env.TELEGRAM_LEAD_DELIVERY_ENABLED,
    CHAT_ID: env.TELEGRAM_LEAD_DELIVERY_CHAT_ID,
  };
});

export type TelegramLeadDeliveryConfigType = ConfigType<typeof telegramLeadDeliveryConfig>;
