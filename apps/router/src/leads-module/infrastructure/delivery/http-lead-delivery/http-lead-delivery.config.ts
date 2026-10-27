import { isDeliveryEnabled } from '@leads-router/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const httpLeadDeliveryConfigSchema = z.object({
  HTTP_LEAD_DELIVERY_ENABLED: z.stringbool(),
  HTTP_LEAD_DELIVERY_ENDPOINTS: z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()))
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
});

const HTTP_LEAD_DELIVERY_CONFIG = 'HTTP_LEAD_DELIVERY_CONFIG';

export const httpLeadDeliveryConfig = registerAs(HTTP_LEAD_DELIVERY_CONFIG, () => {
  if (!isDeliveryEnabled(process.env.HTTP_LEAD_DELIVERY_ENABLED)) {
    return { enabled: false, endpoints: [] };
  }

  const env = httpLeadDeliveryConfigSchema.parse(process.env);

  return {
    enabled: env.HTTP_LEAD_DELIVERY_ENABLED,
    endpoints: env.HTTP_LEAD_DELIVERY_ENDPOINTS,
  };
});

export type HttpLeadDeliveryConfigType = ConfigType<typeof httpLeadDeliveryConfig>;
