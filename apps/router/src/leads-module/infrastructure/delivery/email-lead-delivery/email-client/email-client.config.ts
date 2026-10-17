import { isDeliveryEnabled } from '@leads-router/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const emailClientConfigSchema = z.object({
  EMAIL_CLIENT_HOST: z.string().trim().min(1),
  EMAIL_CLIENT_PORT: z.coerce.number().int().min(1).max(65_535),
  EMAIL_CLIENT_SECURE: z.stringbool(),
  EMAIL_CLIENT_USER: z.string().trim().min(1),
  EMAIL_CLIENT_PASSWORD: z.string().min(1),
  EMAIL_CLIENT_FROM: z.string().trim().pipe(z.email()),
});

const EMAIL_CLIENT_CONFIG = 'EMAIL_CLIENT_CONFIG';

export const emailClientConfig = registerAs(EMAIL_CLIENT_CONFIG, () => {
  // Клиент принадлежит email-адаптеру: пока доставка выключена, SMTP-переменные не валидируются
  // и могут не задаваться в env (см. контракт isDeliveryEnabled)
  if (!isDeliveryEnabled(process.env.EMAIL_LEAD_DELIVERY_ENABLED)) {
    return { host: '', port: 0, secure: false, user: '', password: '', from: '' };
  }

  const env = emailClientConfigSchema.parse(process.env);

  return {
    host: env.EMAIL_CLIENT_HOST,
    port: env.EMAIL_CLIENT_PORT,
    secure: env.EMAIL_CLIENT_SECURE,
    user: env.EMAIL_CLIENT_USER,
    password: env.EMAIL_CLIENT_PASSWORD,
    from: env.EMAIL_CLIENT_FROM,
  };
});

export type EmailClientConfigType = ConfigType<typeof emailClientConfig>;
