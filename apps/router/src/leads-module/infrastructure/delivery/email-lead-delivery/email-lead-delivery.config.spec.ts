import { ZodError } from 'zod';

import { emailClientConfig } from './email-client/email-client.config';
import { emailLeadDeliveryConfig } from './email-lead-delivery.config';

// Пока EMAIL_LEAD_DELIVERY_ENABLED выключен, фабрики конфигурации адаптера и клиента возвращают конфигурацию отключённого адаптера
// и не парсят схемы — TO и SMTP-переменные могут отсутствовать
describe('email lead delivery config', () => {
  const ENV_KEYS = [
    'EMAIL_LEAD_DELIVERY_ENABLED',
    'EMAIL_LEAD_DELIVERY_TO',
    'EMAIL_CLIENT_HOST',
    'EMAIL_CLIENT_PORT',
    'EMAIL_CLIENT_SECURE',
    'EMAIL_CLIENT_REQUIRE_TLS',
    'EMAIL_CLIENT_USER',
    'EMAIL_CLIENT_PASSWORD',
    'EMAIL_CLIENT_FROM',
    'EMAIL_CLIENT_CONNECTION_TIMEOUT',
    'EMAIL_CLIENT_GREETING_TIMEOUT',
    'EMAIL_CLIENT_SOCKET_TIMEOUT',
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
      expect(emailLeadDeliveryConfig()).toEqual({ enabled: false, to: '' });
    });

    it('returns a disabled stub when the flag is false, ignoring a malformed recipient', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'false';
      process.env.EMAIL_LEAD_DELIVERY_TO = 'not-an-email';

      expect(emailLeadDeliveryConfig()).toEqual({ enabled: false, to: '' });
    });

    it('parses the recipient when the adapter is enabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      process.env.EMAIL_LEAD_DELIVERY_TO = 'inbox@example.com';

      expect(emailLeadDeliveryConfig()).toEqual({ enabled: true, to: 'inbox@example.com' });
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

    const disabledStub = {
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

    it('returns a stub when the flag is not set', () => {
      expect(emailClientConfig()).toEqual(disabledStub);
    });

    it('ignores malformed SMTP settings while the adapter is disabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'false';
      process.env.EMAIL_CLIENT_HOST = '';
      process.env.EMAIL_CLIENT_PORT = 'garbage';
      process.env.EMAIL_CLIENT_USER = '';
      process.env.EMAIL_CLIENT_PASSWORD = '';
      process.env.EMAIL_CLIENT_FROM = 'not-an-email';

      expect(emailClientConfig()).toEqual(disabledStub);
    });

    it('parses SMTP settings with timeout defaults when the adapter is enabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      Object.assign(process.env, validClientEnv);

      expect(emailClientConfig()).toEqual({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        user: 'leads@example.com',
        password: 'app-password',
        from: 'leads@example.com',
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      });
    });

    it('overrides the timeout defaults from env when provided', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      Object.assign(process.env, validClientEnv, {
        EMAIL_CLIENT_CONNECTION_TIMEOUT: '5000',
        EMAIL_CLIENT_GREETING_TIMEOUT: '6000',
        EMAIL_CLIENT_SOCKET_TIMEOUT: '7000',
      });

      expect(emailClientConfig()).toEqual({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        user: 'leads@example.com',
        password: 'app-password',
        from: 'leads@example.com',
        connectionTimeout: 5000,
        greetingTimeout: 6000,
        socketTimeout: 7000,
      });
    });

    it('allows plaintext SMTP only when STARTTLS is explicitly not required', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      Object.assign(process.env, validClientEnv, { EMAIL_CLIENT_REQUIRE_TLS: 'false' });

      expect(emailClientConfig()).toMatchObject({ secure: false, requireTLS: false });
    });

    it('fails fast on a non-positive timeout when the adapter is enabled', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';
      Object.assign(process.env, validClientEnv, { EMAIL_CLIENT_SOCKET_TIMEOUT: '0' });

      expect(() => emailClientConfig()).toThrow(ZodError);
    });

    it('fails fast when the adapter is enabled but SMTP settings are missing', () => {
      process.env.EMAIL_LEAD_DELIVERY_ENABLED = 'true';

      expect(() => emailClientConfig()).toThrow(ZodError);
    });
  });
});
