import { readFile } from 'node:fs/promises';

import { generateLeadId, LeadEntity } from '@leads-router/common';
import request from 'supertest';

import {
  httpLeadDeliveryConfig,
  type HttpLeadDeliveryConfigType,
} from '../../../router/src/leads-module/infrastructure/delivery/http-lead-delivery/http-lead-delivery.config';
import { TelegramLeadDeliveryAdapter } from '../../../router/src/leads-module/infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.adapter';
import { LeadsProcessor } from '../../../router/src/leads-module/presentation/queue/leads.processor';
import type { E2eEnvironment } from '../support/environment';
import { startHttpSink } from '../support/http-sink';
import { waitFor } from '../support/wait-for';

export function routerWorkerSuite(env: () => E2eEnvironment): void {
  describe('disabled channels', () => {
    it('router skips disabled telegram channel with a verbose log', async () => {
      const { useCaseVerbose, postLead } = env();

      // Канал включён глобально, поэтому адаптер отключается точечно:
      // тест проверяет пропуск лида в use-case, а не чтение конфига
      const enabled = jest.spyOn(TelegramLeadDeliveryAdapter.prototype, 'enabled', 'get').mockReturnValue(false);

      try {
        // Verbose-лог не содержит идентификатора лида, поэтому тест фиксирует счётчик
        // вызовов до отправки и ждёт его увеличения
        const skipsBefore = useCaseVerbose.mock.calls.length;

        await postLead('telegram-skip');

        await waitFor(() => useCaseVerbose.mock.calls.length > skipsBefore, 10_000, 'telegram skip verbose log');
      } finally {
        enabled.mockRestore();
      }
    });
  });

  describe('worker health', (): void => {
    it('keeps the heartbeat fresh while the worker is connected to Redis', async (): Promise<void> => {
      const { heartbeatFile } = env();

      const beatAt = await waitFor(
        async (): Promise<number | undefined> =>
          Number(await readFile(heartbeatFile, 'utf8').catch((): string => '')) || undefined,
        10_000,
        'router heartbeat',
      );

      expect(Date.now() - beatAt).toBeLessThan(15_000);
    });
  });

  describe('worker concurrency', (): void => {
    it('processes two slow deliveries in parallel when concurrency is raised', async (): Promise<void> => {
      const { gatewayApp, routerApp, settledHttpJob, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const slow = await startHttpSink({ delayMs: 700 });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const processor = routerApp.get(LeadsProcessor);
      processor.worker.concurrency = 2;
      config.endpoints = [`http://127.0.0.1:${slow.port.toString()}/leads`];
      try {
        const first = new LeadEntity(generateLeadId(), 'Concurrency A', 'concurrency-a@test.local', 'hello');
        const second = new LeadEntity(generateLeadId(), 'Concurrency B', 'concurrency-b@test.local', 'hello');

        await Promise.all([
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(first).expect(201),
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(second).expect(201),
        ]);

        await settledHttpJob(first.id);
        await settledHttpJob(second.id);

        // Две медленные доставки обрабатывались одновременно; concurrency=2 не даёт большего числа
        expect(slow.maxConcurrent).toBe(2);
      } finally {
        processor.worker.concurrency = 1;
        config.endpoints = endpoints;
        await slow.close();
      }
    });
  });
}
