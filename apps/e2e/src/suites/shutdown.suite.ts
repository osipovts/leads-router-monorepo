import { ChannelEnum, generateLeadId, LeadEntity } from '@leads-router/common';
import request from 'supertest';

import { SendLeadUseCase } from '../../../router/src/leads-module/application/use-cases/send-lead.use-case';
import { LeadsProcessor } from '../../../router/src/leads-module/presentation/queue/leads.processor';
import type { E2eEnvironment } from '../support/environment';
import { waitFor } from '../support/wait-for';

export function shutdownSuite(env: () => E2eEnvironment): void {
  describe('shutdown', (): void => {
    it('drains an active database delivery before disconnecting Prisma', async (): Promise<void> => {
      const { gatewayApp, routerApp, prisma, waitForQueueIdle } = env();

      await waitForQueueIdle();
      const lead = new LeadEntity(generateLeadId(), 'Shutdown', 'shutdown@test.local', 'hello');
      const useCase = routerApp.get(SendLeadUseCase);
      const processor = routerApp.get(LeadsProcessor);
      const execute = useCase.execute.bind(useCase);
      const disconnect = prisma.$disconnect.bind(prisma);
      const closeWorker = processor.worker.close.bind(processor.worker);
      const order: string[] = [];
      let release!: () => void;
      let handling = false;
      let draining = false;
      const pending = new Promise<void>((resolve): void => {
        release = resolve;
      });
      const sending = jest
        .spyOn(useCase, 'execute')
        .mockImplementation(async (channel, current, checkpoint): Promise<void> => {
          const target = current.id === lead.id && channel === ChannelEnum.DATABASE;
          if (target) {
            handling = true;
            await pending;
          }
          await execute(channel, current, checkpoint);
          if (target) {
            order.push('saved');
          }
        });
      const disconnecting = jest.spyOn(prisma, '$disconnect').mockImplementation(async (): Promise<void> => {
        order.push('disconnected');
        await disconnect();
      });
      const drainingWorker = jest.spyOn(processor.worker, 'close').mockImplementation(async (force): Promise<void> => {
        draining = true;
        await closeWorker(force);
      });
      let closing: Promise<void> | undefined;
      try {
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);
        await waitFor((): boolean => handling);
        closing = routerApp.close();
        await waitFor((): boolean => draining);
        expect(disconnecting).not.toHaveBeenCalled();
      } finally {
        release();
        await closing;
        sending.mockRestore();
        disconnecting.mockRestore();
        drainingWorker.mockRestore();
      }
      expect(order).toEqual(['saved', 'disconnected']);
    });
  });
}
