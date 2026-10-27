import { ChannelEnum, generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import request from 'supertest';

import type { E2eEnvironment } from '../support/environment';

export function infrastructureFailuresSuite(env: () => E2eEnvironment): void {
  describe('infrastructure failures', (): void => {
    it('returns 503 within the Redis command budget and recovers after Redis resumes', async (): Promise<void> => {
      const { redis, gatewayApp, queuedChannels, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const lead = new LeadEntity(generateLeadId(), 'Redis timeout', 'redis-timeout@test.local', 'hello');
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      await redis.exec(['redis-cli', 'CLIENT', 'PAUSE', '8000', 'ALL']);
      try {
        const startedAt = Date.now();
        await request(gatewayApp.getHttpServer())
          .post('/api/v1/leads')
          .send(lead)
          .timeout({ response: 7_000, deadline: 7_500 })
          .expect(503);
        expect(Date.now() - startedAt).toBeLessThan(7_000);
      } finally {
        await redis.exec(['redis-cli', 'PING']);
        errors.mockRestore();
      }
      await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
      expect(await queuedChannels(lead.id)).toEqual(Object.values(ChannelEnum).sort());
    });
  });
}
