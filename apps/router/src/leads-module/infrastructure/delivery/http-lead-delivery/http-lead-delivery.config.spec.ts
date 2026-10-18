import { ZodError } from 'zod';

import { httpClientConfig } from './http-client/http-client.config';
import { httpLeadDeliveryConfig } from './http-lead-delivery.config';

// Пока HTTP_LEAD_DELIVERY_ENABLED выключен, фабрики конфигурации адаптера и клиента возвращают конфигурацию отключённого адаптера
// и не парсят схемы — ENDPOINTS и настройки клиента могут отсутствовать
describe('http lead delivery config', () => {
  const ENV_KEYS = ['HTTP_LEAD_DELIVERY_ENABLED', 'HTTP_LEAD_DELIVERY_ENDPOINTS', 'HTTP_CLIENT_TIMEOUT'] as const;

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

  describe('httpLeadDeliveryConfig', () => {
    it('returns a disabled stub when the flag is not set', () => {
      expect(httpLeadDeliveryConfig()).toEqual({ ENABLED: false, ENDPOINTS: [] });
    });

    it('returns a disabled stub when the flag is false, ignoring malformed endpoints', () => {
      process.env.HTTP_LEAD_DELIVERY_ENABLED = 'false';
      process.env.HTTP_LEAD_DELIVERY_ENDPOINTS = 'not-a-url';

      expect(httpLeadDeliveryConfig()).toEqual({ ENABLED: false, ENDPOINTS: [] });
    });

    it('parses endpoints when the adapter is enabled', () => {
      process.env.HTTP_LEAD_DELIVERY_ENABLED = 'true';
      process.env.HTTP_LEAD_DELIVERY_ENDPOINTS = 'http://a.example/leads, https://b.example/leads';

      expect(httpLeadDeliveryConfig()).toEqual({
        ENABLED: true,
        ENDPOINTS: ['http://a.example/leads', 'https://b.example/leads'],
      });
    });

    it('fails fast when the adapter is enabled but endpoints are missing', () => {
      process.env.HTTP_LEAD_DELIVERY_ENABLED = 'true';

      expect(() => httpLeadDeliveryConfig()).toThrow(ZodError);
    });
  });

  describe('httpClientConfig', () => {
    it('returns a stub when the flag is not set', () => {
      expect(httpClientConfig()).toEqual({ timeout: 0 });
    });

    it('ignores malformed client settings while the adapter is disabled', () => {
      process.env.HTTP_LEAD_DELIVERY_ENABLED = 'false';
      process.env.HTTP_CLIENT_TIMEOUT = 'garbage';

      expect(httpClientConfig()).toEqual({ timeout: 0 });
    });

    it('parses the timeout when the adapter is enabled', () => {
      process.env.HTTP_LEAD_DELIVERY_ENABLED = 'true';
      process.env.HTTP_CLIENT_TIMEOUT = '1000';

      expect(httpClientConfig()).toEqual({ timeout: 1000 });
    });

    it('fails fast when the adapter is enabled but client settings are missing', () => {
      process.env.HTTP_LEAD_DELIVERY_ENABLED = 'true';

      expect(() => httpClientConfig()).toThrow(ZodError);
    });
  });
});
