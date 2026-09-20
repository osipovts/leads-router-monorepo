import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const consoleLeadDeliveryConfigSchema = z.object({
  CONSOLE_LEAD_DELIVERY_ENABLED: z.stringbool(),
});

const CONSOLE_LEAD_DELIVERY_CONFIG = 'CONSOLE_LEAD_DELIVERY_CONFIG';

export const consoleLeadDeliveryConfig = registerAs(CONSOLE_LEAD_DELIVERY_CONFIG, () => {
  const env = consoleLeadDeliveryConfigSchema.parse(process.env);

  return {
    ENABLED: env.CONSOLE_LEAD_DELIVERY_ENABLED,
  };
});

export type ConsoleLeadDeliveryConfigType = ConfigType<typeof consoleLeadDeliveryConfig>;
