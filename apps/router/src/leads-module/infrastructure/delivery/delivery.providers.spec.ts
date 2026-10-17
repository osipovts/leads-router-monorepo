import { ChannelEnum } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { PrismaModule } from '../../../common/infrastructure/prisma/prisma.module';
import { LEAD_DELIVERY_ADAPTERS, type LeadDeliveryPort } from '../../application/ports/lead-delivery.port';
import { LeadsModule } from '../../leads.module';
import { DELIVERY_ADAPTER_MODULES } from './delivery.providers';

// Реестр адаптеров собирается DI-фабрикой LeadsModule. Инвариант: каждый канал ChannelEnum
// зарегистрирован - gateway фан-аутит во все каналы
describe('delivery adapter registry', () => {
  const ENV_KEYS = [
    'CONSOLE_LEAD_DELIVERY_ENABLED',
    'DATABASE_LEAD_DELIVERY_ENABLED',
    'TELEGRAM_LEAD_DELIVERY_ENABLED',
    'HTTP_LEAD_DELIVERY_ENABLED',
    'EMAIL_LEAD_DELIVERY_ENABLED',
    'DATABASE_URL',
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

  it('declares a delivery module for every channel', () => {
    expect(DELIVERY_ADAPTER_MODULES).toHaveLength(Object.values(ChannelEnum).length);
  });

  it('wires a disabled adapter for every channel without service env', async () => {
    for (const key of ENV_KEYS) {
      Reflect.deleteProperty(process.env, key);
    }

    const testingModule = await Test.createTestingModule({
      // Соединение BullMQ ленивое: реального Redis в юнит-тесте нет и не нужно
      imports: [BullModule.forRoot({ connection: { host: '127.0.0.1', port: 6_379 } }), PrismaModule, LeadsModule],
    }).compile();

    const adapters = testingModule.get<ReadonlyMap<ChannelEnum, LeadDeliveryPort>>(LEAD_DELIVERY_ADAPTERS);

    expect([...adapters.keys()].sort()).toEqual([...Object.values(ChannelEnum)].sort());
    for (const adapter of adapters.values()) {
      expect(adapter.enabled).toBe(false);
    }

    await testingModule.close();
  });
});
