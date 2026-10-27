import { ChannelEnum, generateLeadId, LeadEntity } from '@leads-router/common';
import request from 'supertest';

import { BullmqQueueService } from '../../../gateway/src/leads-module/infrastructure/queue/bullmq-queue.service';
import { leadsQueueConfig, type LeadsQueueConfigType } from '../../../gateway/src/leads-module/leads.config';
import type { E2eEnvironment } from '../support/environment';
import { waitFor } from '../support/wait-for';

export function idempotencySuite(env: () => E2eEnvironment): void {
  describe('idempotency', () => {
    it('accepts the same lead again after the deduplication TTL expires', async (): Promise<void> => {
      const { gatewayApp, leadsQueue, queuedChannels } = env();

      const config = gatewayApp.get<LeadsQueueConfigType>(leadsQueueConfig.KEY);
      const sender = new BullmqQueueService(leadsQueue, config, { ttlMs: 1_000 });
      const lead = new LeadEntity(generateLeadId(), 'TTL', 'ttl@test.local', 'hello');

      await sender.sendLead(ChannelEnum.CONSOLE, lead);
      await sender.sendLead(ChannelEnum.CONSOLE, lead);
      expect(await queuedChannels(lead.id)).toEqual([ChannelEnum.CONSOLE]);

      await waitFor(
        async (): Promise<boolean> => (await leadsQueue.getDeduplicationJobId(`${lead.id}-console`)) === null,
      );
      await sender.sendLead(ChannelEnum.CONSOLE, lead);
      expect(await queuedChannels(lead.id)).toEqual([ChannelEnum.CONSOLE, ChannelEnum.CONSOLE]);
    });

    it('deduplicates concurrent requests independently for every channel', async (): Promise<void> => {
      const { gatewayApp, queuedChannels } = env();

      const lead = new LeadEntity(generateLeadId(), 'Concurrent', 'concurrent@test.local', 'hello');

      await Promise.all([
        request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201),
        request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201),
      ]);

      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('retries missing channels without duplicating accepted jobs after a partial failure', async (): Promise<void> => {
      const { gatewayApp, leadsQueue, queuedChannels } = env();

      const lead = new LeadEntity(generateLeadId(), 'Retry', 'retry@test.local', 'hello');
      const realAdd = leadsQueue.add.bind(leadsQueue);
      const add = jest
        .spyOn(leadsQueue, 'add')
        .mockImplementation((name, data, options): ReturnType<typeof realAdd> => {
          if (data.lead.id === lead.id && data.channel === ChannelEnum.EMAIL) {
            return Promise.reject(new Error('simulated enqueue failure'));
          }
          return realAdd(name, data, options);
        });

      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503);
        expect(await queuedChannels(lead.id)).toEqual(
          Object.values(ChannelEnum)
            .filter((channel): boolean => channel !== ChannelEnum.EMAIL)
            .sort(),
        );
      } finally {
        add.mockRestore();
      }

      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('does not acknowledge either concurrent request when all enqueue operations fail', async (): Promise<void> => {
      const { gatewayApp, leadsQueue, queuedChannels } = env();

      const lead = new LeadEntity(generateLeadId(), 'Unavailable', 'unavailable@test.local', 'hello');
      const add = jest.spyOn(leadsQueue, 'add').mockRejectedValue(new Error('simulated Redis outage'));

      try {
        await Promise.all([
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503),
          request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(503),
        ]);
        expect(await queuedChannels(lead.id)).toEqual([]);
      } finally {
        add.mockRestore();
      }

      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });

    it('skips broadcast for a duplicate lead posted with the same id', async () => {
      const { http, gatewayApp, postLead } = env();

      const { lead, response } = await postLead('idempotency');
      const id = (response.body as { data: { id: string } }).data.id;

      await waitFor(
        () => http.requests.find((entry) => (entry.body as { contact?: string }).contact === lead.contact),
        10_000,
        'first delivery',
      );

      // Повтор запроса с тем же id (как ретрай клиента или пересылка каскадом)
      const duplicate = await request(gatewayApp.getHttpServer())
        .post('/api/v1/leads')
        .send({ id, ...lead })
        .expect(201);

      expect((duplicate.body as { data: { id: string } }).data.id).toBe(id);

      // Второй доставки не было: в http-синке по-прежнему ровно один запрос этого лида
      await new Promise((resolve) => {
        setTimeout(resolve, 1_500);
      });
      expect(
        http.requests.filter((entry) => (entry.body as { contact?: string }).contact === lead.contact),
      ).toHaveLength(1);
    });
  });
}
