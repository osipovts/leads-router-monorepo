import { ZodError } from 'zod';

import { telegramClientConfig } from './telegram-client/telegram-client.config';
import { telegramLeadDeliveryConfig } from './telegram-lead-delivery.config';

// Пока TELEGRAM_LEAD_DELIVERY_ENABLED выключен, обе конфиг-фабрики адаптера возвращают стаб
// и не парсят схемы — CHAT_ID и токен могут отсутствовать в env
describe('telegram lead delivery config', () => {
  const ENV_KEYS = [
    'TELEGRAM_LEAD_DELIVERY_ENABLED',
    'TELEGRAM_LEAD_DELIVERY_CHAT_ID',
    'TELEGRAM_CLIENT_TOKEN',
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

  describe('telegramLeadDeliveryConfig', () => {
    it('returns a disabled stub when the flag is not set', () => {
      expect(telegramLeadDeliveryConfig()).toEqual({ ENABLED: false, CHAT_ID: '' });
    });

    it('returns a disabled stub when the flag is false, ignoring an empty chat id', () => {
      process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'false';
      process.env.TELEGRAM_LEAD_DELIVERY_CHAT_ID = '';

      expect(telegramLeadDeliveryConfig()).toEqual({ ENABLED: false, CHAT_ID: '' });
    });

    it('parses the chat id when the adapter is enabled', () => {
      process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'true';
      process.env.TELEGRAM_LEAD_DELIVERY_CHAT_ID = ' 193166758 ';

      expect(telegramLeadDeliveryConfig()).toEqual({ ENABLED: true, CHAT_ID: '193166758' });
    });

    it('fails fast when the adapter is enabled but the chat id is missing', () => {
      process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'true';

      expect(() => telegramLeadDeliveryConfig()).toThrow(ZodError);
    });
  });

  describe('telegramClientConfig', () => {
    it('returns a token stub when the flag is not set', () => {
      expect(telegramClientConfig()).toEqual({ token: '' });
    });

    it('ignores the token entirely while the adapter is disabled', () => {
      process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'false';
      process.env.TELEGRAM_CLIENT_TOKEN = 'garbage';

      expect(telegramClientConfig()).toEqual({ token: '' });
    });

    it('parses the token when the adapter is enabled', () => {
      process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'true';
      process.env.TELEGRAM_CLIENT_TOKEN = '1234567890:token';

      expect(telegramClientConfig()).toEqual({ token: '1234567890:token' });
    });

    it('fails fast when the adapter is enabled but the token is missing', () => {
      process.env.TELEGRAM_LEAD_DELIVERY_ENABLED = 'true';

      expect(() => telegramClientConfig()).toThrow(ZodError);
    });
  });
});
