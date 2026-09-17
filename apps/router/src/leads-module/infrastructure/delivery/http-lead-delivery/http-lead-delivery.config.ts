import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const httpLeadDeliveryConfigSchema = z.object({
  HTTP_LEAD_DELIVERY_ENABLED: z
    .string()
    .transform((value) => value.toLowerCase())
    .pipe(z.enum(['true', 'false']))
    .transform((value) => value === 'true'),
  HTTP_LEAD_DELIVERY_ENDPOINTS: z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()))
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
});

const HTTP_LEAD_DELIVERY_CONFIG = 'HTTP_LEAD_DELIVERY_CONFIG';

export const httpLeadDeliveryConfig = registerAs(HTTP_LEAD_DELIVERY_CONFIG, () => {
  const env = httpLeadDeliveryConfigSchema.parse(process.env);

  return {
    ENABLED: env.HTTP_LEAD_DELIVERY_ENABLED,
    ENDPOINTS: env.HTTP_LEAD_DELIVERY_ENDPOINTS,
  };
});

export type HttpLeadDeliveryConfigType = ConfigType<typeof httpLeadDeliveryConfig>;
