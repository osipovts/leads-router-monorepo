import { isDeliveryEnabled } from '@leads-router/common';
import type { ConfigType } from '@nestjs/config';
import { registerAs } from '@nestjs/config';
import z from 'zod';

const emailClientConfigSchema = z.object({
  EMAIL_CLIENT_HOST: z.string().trim().min(1),
  EMAIL_CLIENT_PORT: z.coerce.number().int().min(1).max(65_535),
  EMAIL_CLIENT_SECURE: z.stringbool(),
  // При SECURE=false без STARTTLS nodemailer передал бы пароль и лид открытым текстом;
  // отказ от шифрования — только явной настройкой
  EMAIL_CLIENT_REQUIRE_TLS: z.stringbool().default(true),
  EMAIL_CLIENT_USER: z.string().trim().min(1),
  EMAIL_CLIENT_PASSWORD: z.string().min(1),
  EMAIL_CLIENT_FROM: z.string().trim().pipe(z.email()),
  // Дефолты nodemailer (2 мин / 30 с / 10 мин) надолго занимают слот воркера при зависании SMTP,
  // поэтому переопределяются более короткими значениями (в миллисекундах)
  EMAIL_CLIENT_CONNECTION_TIMEOUT: z.coerce.number().int().min(1).max(600_000).default(10_000),
  EMAIL_CLIENT_GREETING_TIMEOUT: z.coerce.number().int().min(1).max(600_000).default(10_000),
  EMAIL_CLIENT_SOCKET_TIMEOUT: z.coerce.number().int().min(1).max(600_000).default(30_000),
});

const EMAIL_CLIENT_CONFIG = 'EMAIL_CLIENT_CONFIG';

export const emailClientConfig = registerAs(EMAIL_CLIENT_CONFIG, () => {
  // Клиент принадлежит email-адаптеру: пока доставка выключена, SMTP-переменные не валидируются
  // и могут не задаваться в env (см. контракт isDeliveryEnabled)
  if (!isDeliveryEnabled(process.env.EMAIL_LEAD_DELIVERY_ENABLED)) {
    return {
      host: '',
      port: 0,
      secure: false,
      requireTLS: true,
      user: '',
      password: '',
      from: '',
      connectionTimeout: 0,
      greetingTimeout: 0,
      socketTimeout: 0,
    };
  }

  const env = emailClientConfigSchema.parse(process.env);

  return {
    host: env.EMAIL_CLIENT_HOST,
    port: env.EMAIL_CLIENT_PORT,
    secure: env.EMAIL_CLIENT_SECURE,
    requireTLS: env.EMAIL_CLIENT_REQUIRE_TLS,
    user: env.EMAIL_CLIENT_USER,
    password: env.EMAIL_CLIENT_PASSWORD,
    from: env.EMAIL_CLIENT_FROM,
    connectionTimeout: env.EMAIL_CLIENT_CONNECTION_TIMEOUT,
    greetingTimeout: env.EMAIL_CLIENT_GREETING_TIMEOUT,
    socketTimeout: env.EMAIL_CLIENT_SOCKET_TIMEOUT,
  };
});

export type EmailClientConfigType = ConfigType<typeof emailClientConfig>;
