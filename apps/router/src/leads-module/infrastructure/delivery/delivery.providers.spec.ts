import { ChannelEnum, QUEUES } from '@leads-router/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { PrismaModule } from '../../../common/infrastructure/prisma/prisma.module';
import { LEAD_DELIVERY_ADAPTERS, type LeadDeliveryPort } from '../../application/ports/lead-delivery.port';
import { LeadsModule } from '../../leads.module';
import { DELIVERY_ADAPTER_MODULES } from './delivery.providers';

// Реестр адаптеров собирается DI-фабрикой LeadsModule. Инвариант: каждый канал ChannelEnum
// зарегистрирован, поскольку gateway отправляет лиды во все каналы.
describe('delivery adapter registry', () => {
  const ENV_KEYS: readonly string[] = [
    'CONSOLE_LEAD_DELIVERY_ENABLED',
    'DATABASE_LEAD_DELIVERY_ENABLED',
    'TELEGRAM_LEAD_DELIVERY_ENABLED',
    'HTTP_LEAD_DELIVERY_ENABLED',
    'EMAIL_LEAD_DELIVERY_ENABLED',
    'DATABASE_URL',
  ];

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
      imports: [BullModule.forRoot({ connection: { host: '127.0.0.1', port: 6_379 } }), PrismaModule, LeadsModule],
    })
      // Проверяется сборка реестра адаптеров; соединение с Redis в этом тесте не требуется.
      .overrideProvider(getQueueToken(QUEUES.LEADS.QUEUE_NAME))
      .useValue({})
      .compile();

    try {
      const adapters = testingModule.get<ReadonlyMap<ChannelEnum, LeadDeliveryPort>>(LEAD_DELIVERY_ADAPTERS);

      expect([...adapters.keys()].sort()).toEqual([...Object.values(ChannelEnum)].sort());
      for (const adapter of adapters.values()) {
        expect(adapter.enabled).toBe(false);
      }
    } finally {
      await testingModule.close();
    }
  });
});
