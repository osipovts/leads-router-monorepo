import { isDeliveryEnabled } from '@leads-router/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const emailLeadDeliveryConfigSchema = z.object({
  EMAIL_LEAD_DELIVERY_ENABLED: z.stringbool(),
  EMAIL_LEAD_DELIVERY_TO: z.string().trim().pipe(z.email()),
});

const EMAIL_LEAD_DELIVERY_CONFIG = 'EMAIL_LEAD_DELIVERY_CONFIG';

export const emailLeadDeliveryConfig = registerAs(EMAIL_LEAD_DELIVERY_CONFIG, () => {
  if (!isDeliveryEnabled(process.env.EMAIL_LEAD_DELIVERY_ENABLED)) {
    return { enabled: false, to: '' };
  }

  const env = emailLeadDeliveryConfigSchema.parse(process.env);

  return {
    enabled: env.EMAIL_LEAD_DELIVERY_ENABLED,
    to: env.EMAIL_LEAD_DELIVERY_TO,
  };
});

export type EmailLeadDeliveryConfigType = ConfigType<typeof emailLeadDeliveryConfig>;
