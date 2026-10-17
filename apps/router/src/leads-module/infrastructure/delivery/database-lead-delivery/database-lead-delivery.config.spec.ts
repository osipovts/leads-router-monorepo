import { ZodError } from 'zod';

import { databaseLeadDeliveryConfig } from './database-lead-delivery.config';

// Пока флаг адаптера не включён явно, конфиг-фабрика возвращает стаб и не парсит схему
// (см. libs/common delivery-enabled.ts)
describe('databaseLeadDeliveryConfig', () => {
  const ENV_KEYS = ['DATABASE_LEAD_DELIVERY_ENABLED'] as const;

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

  it('returns a disabled stub when the flag is not set', () => {
    expect(databaseLeadDeliveryConfig()).toEqual({ ENABLED: false });
  });

  it('returns a disabled stub when the flag is false', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'false';

    expect(databaseLeadDeliveryConfig()).toEqual({ ENABLED: false });
  });

  it('parses the flag when the adapter is enabled', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'true';

    expect(databaseLeadDeliveryConfig()).toEqual({ ENABLED: true });
  });

  it('fails fast on a malformed flag', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'maybe';

    expect(() => databaseLeadDeliveryConfig()).toThrow(ZodError);
  });
});
