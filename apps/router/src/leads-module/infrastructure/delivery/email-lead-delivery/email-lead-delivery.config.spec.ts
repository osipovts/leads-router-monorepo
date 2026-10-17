import { ZodError } from 'zod';

import { emailClientConfig } from './email-client/email-client.config';
import { emailLeadDeliveryConfig } from './email-lead-delivery.config';

// Пока EMAIL_LEAD_DELIVERY_ENABLED выключен, обе конфиг-фабрики адаптера возвращают стаб
// и не парсят схемы — TO и SMTP-переменные могут отсутствовать
describe('email lead delivery config', () => {
  const ENV_KEYS = [
    'EMAIL_LEAD_DELIVERY_ENABLED',
    'EMAIL_LEAD_DELIVERY_TO',
    'EMAIL_CLIENT_HOST',
    'EMAIL_CLIENT_PORT',
    'EMAIL_CLIENT_SECURE',
    'EMAIL_CLIENT_USER',
    'EMAIL_CLIENT_PASSWORD',
    'EMAIL_CLIENT_FROM',
  ] as const;

  let savedEnv: Record<string, string | undefined>;

  beforeAll(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      Reflect.deleteProperty(process.env, key);
    }
  });

  describe('emailLeadDeliveryConfig', () => {
    it('returns a disabled stub when the flag is not set', () => {
      expect(emailLeadDeliveryConfig()).toEqual({ ENABLED: false, TO: '' });
    });

    it('returns a disabled stub when the flag is false, ignoring a malformed recipient', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'false';
      process.env.EMAIL_LEAD_DELIVERY_TO = 'not-an-email';

      expect(emailLeadDeliveryConfig()).toEqual({ ENABLED: false, TO: '' });
    });

    it('parses the recipient when the adapter is enabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      process.env.EMAIL_LEAD_DELIVERY_TO = 'inbox@example.com';

      expect(emailLeadDeliveryConfig()).toEqual({ ENABLED: true, TO: 'inbox@example.com' });
    });

    it('fails fast when the adapter is enabled but the recipient is malformed', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      process.env.EMAIL_LEAD_DELIVERY_TO = 'not-an-email';

      expect(() => emailLeadDeliveryConfig()).toThrow(ZodError);
    });
  });

  describe('emailClientConfig', () => {
    const validClientEnv = {
      EMAIL_CLIENT_HOST: 'smtp.example.com',
      EMAIL_CLIENT_PORT: '587',
      EMAIL_CLIENT_SECURE: 'false',
      EMAIL_CLIENT_USER: 'leads@example.com',
      EMAIL_CLIENT_PASSWORD: 'app-password',
      EMAIL_CLIENT_FROM: 'leads@example.com',
    } as const;

    it('returns a stub when the flag is not set', () => {
      expect(emailClientConfig()).toEqual({ host: '', port: 0, secure: false, user: '', password: '', from: '' });
    });

    it('ignores malformed SMTP settings while the adapter is disabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'false';
      process.env.EMAIL_CLIENT_HOST = '';
      process.env.EMAIL_CLIENT_PORT = 'garbage';
      process.env.EMAIL_CLIENT_USER = '';
      process.env.EMAIL_CLIENT_PASSWORD = '';
      process.env.EMAIL_CLIENT_FROM = 'not-an-email';

      expect(emailClientConfig()).toEqual({ host: '', port: 0, secure: false, user: '', password: '', from: '' });
    });

    it('parses SMTP settings when the adapter is enabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      Object.assign(process.env, validClientEnv);

      expect(emailClientConfig()).toEqual({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'leads@example.com',
        password: 'app-password',
        from: 'leads@example.com',
      });
    });

    it('fails fast when the adapter is enabled but SMTP settings are missing', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';

      expect(() => emailClientConfig()).toThrow(ZodError);
    });
  });
});
