import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const databaseLeadDeliveryConfigSchema = z.object({
  DATABASE_LEAD_DELIVERY_ENABLED: z.stringbool(),
});

const DATABASE_LEAD_DELIVERY_CONFIG = 'DATABASE_LEAD_DELIVERY_CONFIG';

export const databaseLeadDeliveryConfig = registerAs(DATABASE_LEAD_DELIVERY_CONFIG, () => {
  const env = databaseLeadDeliveryConfigSchema.parse(process.env);

  return {
    ENABLED: env.DATABASE_LEAD_DELIVERY_ENABLED,
  };
});

export type DatabaseLeadDeliveryConfigType = ConfigType<typeof databaseLeadDeliveryConfig>;
