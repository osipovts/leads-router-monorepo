import { ChannelEnum, generateLeadId, LeadEntity, LeadEntityValidation } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import request from 'supertest';

import {
  httpLeadDeliveryConfig,
  type HttpLeadDeliveryConfigType,
} from '../../../router/src/leads-module/infrastructure/delivery/http-lead-delivery/http-lead-delivery.config';
import type { E2eEnvironment } from '../support/environment';
import { startHttpSink } from '../support/http-sink';
import { waitFor } from '../support/wait-for';

export function httpAdapterSuite(env: () => E2eEnvironment): void {
  describe('http adapter', () => {
    it('retries only the failed endpoint and preserves its status in failure events', async (): Promise<void> => {
      const { http, gatewayApp, routerApp, settledHttpJob, waitForQueueIdle } = env();

      await waitForQueueIdle();
      let calls = 0;
      const failing = await startHttpSink({
        respond: (): { status: number } => ({ status: ++calls === 1 ? 503 : 200 }),
      });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP retry', 'http-retry@test.local', 'hello');
      config.endpoints = [...endpoints, `http://127.0.0.1:${failing.port.toString()}/leads`];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('completed');
        expect(job.attemptsMade).toBe(2);
        expect(calls).toBe(2);
        // Исправный endpoint принял лид с первой попытки: повтор задачи его пропускает
        expect(
          http.requests.filter(
            (entry): boolean =>
              typeof entry.body === 'object' && entry.body !== null && 'id' in entry.body && entry.body.id === lead.id,
          ),
        ).toHaveLength(1);
        const expectedReason: unknown = expect.stringContaining('"status":503');
        expect(errors).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'lead_delivery_failed',
            channel: ChannelEnum.HTTP,
            reason: expectedReason,
          }),
        );
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
        await failing.close();
      }
    });

    it('does not retry a permanent HTTP error', async (): Promise<void> => {
      const { gatewayApp, routerApp, settledHttpJob, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const failing = await startHttpSink({ respond: (): { status: number } => ({ status: 400 }) });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP rejected', 'http-rejected@test.local', 'hello');
      config.endpoints = [`http://127.0.0.1:${failing.port.toString()}/leads`];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('failed');
        expect(job.attemptsMade).toBe(1);
        expect(failing.requests).toHaveLength(1);
        expect(job.failedReason).toContain('"status":400');
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
        await failing.close();
      }
    });

    it('retries a network error until attempts are exhausted and keeps the code in the reason', async (): Promise<void> => {
      const { gatewayApp, routerApp, settledHttpJob, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP network', 'http-network@test.local', 'hello');
      // Порт 9 (discard) закрыт: соединение отклоняется мгновенно
      config.endpoints = ['http://127.0.0.1:9/leads'];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('failed');
        expect(job.attemptsMade).toBe(3);
        expect(job.failedReason).toContain('"code":"ECONNREFUSED"');
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
      }
    });

    it('fails the delivery when the response body exceeds the size cap', async (): Promise<void> => {
      const { gatewayApp, routerApp, settledHttpJob, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const oversized = await startHttpSink({
        respond: (): { status: number; body: string } => ({ status: 200, body: 'x'.repeat(70_000) }),
      });
      const config = routerApp.get<HttpLeadDeliveryConfigType>(httpLeadDeliveryConfig.KEY);
      const endpoints = config.endpoints;
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      const lead = new LeadEntity(generateLeadId(), 'HTTP size', 'http-size@test.local', 'hello');
      config.endpoints = [`http://127.0.0.1:${oversized.port.toString()}/leads`];
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        const job = await settledHttpJob(lead.id);

        expect(await job.getState()).toBe('failed');
        // axios прерывает загрузку без ответа: доступен только код ошибки
        expect(job.failedReason).toContain('"code":"ERR_BAD_RESPONSE"');
      } finally {
        config.endpoints = endpoints;
        errors.mockRestore();
        await oversized.close();
      }
    });

    it('posts the delivered lead to the configured endpoint', async () => {
      const { http, postLead } = env();

      const { lead } = await postLead('http');

      const delivery = await waitFor(
        () => http.requests.find((entry) => (entry.body as { contact?: string }).contact === lead.contact),
        10_000,
        'http sink request',
      );

      expect(delivery.url).toBe('/leads');
      // Каскад получает id лида для дедупликации на своей стороне.
      const anyLeadId: unknown = expect.stringMatching(LeadEntityValidation.id.pattern);
      expect(delivery.body).toMatchObject({ ...lead, id: anyLeadId });
    });
  });
}
