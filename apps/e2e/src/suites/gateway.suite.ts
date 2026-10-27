import { join } from 'node:path';

import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';

import type { E2eEnvironment } from '../support/environment';
import { sleep, waitFor } from '../support/wait-for';

export function gatewaySuite(env: () => E2eEnvironment): void {
  it('shares one Nest instance with gateway and router', (): void => {
    for (const app of ['gateway', 'router']) {
      for (const pkg of ['@nestjs/common', '@nestjs/core']) {
        expect(require.resolve(pkg, { paths: [join(__dirname, '..', '..', '..', app)] })).toBe(require.resolve(pkg));
      }
    }
  });

  describe('gateway', () => {
    it('reports health outside the public /api prefix', async (): Promise<void> => {
      const { gatewayApp } = env();

      const response = await request(gatewayApp.getHttpServer()).get('/health').expect(200);

      expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
    });

    it('logs the final HTTP status after validation and error mapping', async (): Promise<void> => {
      const { gatewayApp } = env();

      const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation((): void => undefined);
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(400);
        expect(debug).toHaveBeenCalledWith(expect.stringContaining('status=400'));
      } finally {
        debug.mockRestore();
      }
    });

    it('documents the successful response in the generated OpenAPI', (): void => {
      const { gatewayApp } = env();

      const document = SwaggerModule.createDocument(gatewayApp, new DocumentBuilder().setVersion('1.0').build());

      expect(document.paths['/api/v1/leads'].post?.responses['201']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/SuccessHttpResponseDto' },
                { properties: { data: { $ref: '#/components/schemas/LeadResponseDto' } } },
              ],
            },
          },
        },
      });
      expect(document.components?.schemas?.LeadResponseDto).toMatchObject({
        required: ['id', 'name', 'contact', 'message'],
      });
    });

    it('accepts a valid lead, generates its id and responds with echoed data', async () => {
      const { postLead } = env();

      const { lead, response } = await postLead('gateway-valid');

      expect(response.body).toMatchObject({ success: true, data: lead });
      expect((response.body as { data: { id: string } }).data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('rejects an invalid lead with a validation error', async () => {
      const { gatewayApp } = env();

      const response = await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(400);

      const body = response.body as { success: boolean; error: { error: string } };

      expect(body.success).toBe(false);
      expect(body.error.error).toBe('BadRequestException');
    });

    it.each(['😀'.repeat(64), '✈️'.repeat(32)])(
      'accepts and stores a name containing 64 Unicode code points: %s',
      async (name): Promise<void> => {
        const { gatewayApp, prisma } = env();

        const lead = new LeadEntity(generateLeadId(), name, 'unicode@test.local', '😀'.repeat(2048));

        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

        const saved = await waitFor(() => prisma.lead.findUnique({ where: { id: lead.id } }));
        expect(saved).toMatchObject({ name: lead.name, message: lead.message });
      },
    );

    it.each(['😀'.repeat(65), '✈️'.repeat(33)])(
      'rejects a name exceeding 64 Unicode code points: %s',
      async (name): Promise<void> => {
        const { gatewayApp } = env();

        const lead = { name, contact: 'unicode@test.local', message: 'hello' };

        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(400);
      },
    );

    it('rate limits requests above the throttle window limit across gateway replicas', async (): Promise<void> => {
      const { gatewayApp, gatewayReplica } = env();

      // Окно очищается от запросов предыдущих тестов и после теста — для следующих
      await sleep(1_100);

      for (let i = 0; i < 20; i += 1) {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(400);
      }

      // Лимит общий: запрос сверх него отклоняет и реплика, которая сама его ещё не считала
      await request(gatewayReplica.getHttpServer()).post('/api/v1/leads').send({ name: '' }).expect(429);

      await sleep(1_100);
    }, 15_000);
  });
}
