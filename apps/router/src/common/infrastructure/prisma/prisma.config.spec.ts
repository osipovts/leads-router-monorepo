import { ZodError } from 'zod';

import { prismaConfig } from './prisma.config';

// Пока флаг database-канала не включён явно, конфиг-фабрика возвращает стаб и не парсит схему
// (см. libs/common delivery-enabled.ts): router запускается без DATABASE_URL
describe('prismaConfig', () => {
  const ENV_KEYS = ['DATABASE_LEAD_DELIVERY_ENABLED', 'DATABASE_URL'] as const;

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
    expect(prismaConfig()).toEqual({ enabled: false, databaseUrl: '' });
  });

  it('returns a disabled stub when the flag is false', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'false';

    expect(prismaConfig()).toEqual({ enabled: false, databaseUrl: '' });
  });

  it('ignores a malformed DATABASE_URL when the channel is disabled', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'false';
    process.env.DATABASE_URL = 'not-a-url';

    expect(prismaConfig()).toEqual({ enabled: false, databaseUrl: '' });
  });

  it('parses DATABASE_URL when the channel is enabled', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'true';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/leads';

    expect(prismaConfig()).toEqual({
      enabled: true,
      databaseUrl: 'postgresql://postgres:postgres@localhost:5432/leads',
    });
  });

  it('fails fast when DATABASE_URL is missing and the channel is enabled', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'true';

    expect(() => prismaConfig()).toThrow(ZodError);
  });

  it('fails fast on a non-postgresql DATABASE_URL when the channel is enabled', () => {
    process.env.DATABASE_LEAD_DELIVERY_ENABLED = 'true';
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/leads';

    expect(() => prismaConfig()).toThrow(ZodError);
  });
});
