import { execFileSync } from 'node:child_process';

import { ChannelEnum, generateLeadId, LeadEntity, type SendLeadJob } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import request from 'supertest';

import { DatabaseClient } from '../../../router/src/leads-module/infrastructure/delivery/database-lead-delivery/database-client/database.client';
import type { E2eEnvironment } from '../support/environment';
import { sleep, waitFor } from '../support/wait-for';

export function databaseAdapterSuite(env: () => E2eEnvironment): void {
  describe('database adapter', () => {
    it('ignores a duplicate primary key even when queue deduplication is bypassed', async (): Promise<void> => {
      const { routerApp, prisma } = env();

      const client = routerApp.get(DatabaseClient);
      const lead = new LeadEntity(generateLeadId(), 'Database duplicate', 'duplicate@test.local', 'hello');

      await client.saveLead(lead);
      await client.saveLead(lead);

      expect(await prisma.lead.count({ where: { id: lead.id } })).toBe(1);
    });

    it('saves the delivered lead to postgres', async () => {
      const { prisma, postLead } = env();

      const { lead } = await postLead('database');

      const savedRow = await waitFor(
        () => prisma.lead.findFirst({ where: { contact: lead.contact } }),
        10_000,
        'database row saved',
      );

      expect(savedRow).toMatchObject({ name: lead.name, contact: lead.contact, message: lead.message });
    });

    it('fails database jobs while postgres is down and recovers after a restart', async (): Promise<void> => {
      const { postgres, gatewayApp, prisma, leadsQueue, waitForQueueIdle, postLead } = env();

      await waitForQueueIdle();
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      // restart() у testcontainers повторно применяет wait-strategy со счетчиком повторений
      // лога, который перезапущенный postgres уже не выдаёт, поэтому контейнер
      // останавливается без удаления и поднимается docker start без ожидания готовности
      const containerName = postgres.getName().replace(/^\//, '');
      // Rootless docker освобождает проброшенный порт с задержкой: немедленный старт
      // после остановки падает с "address already in use", поэтому старт повторяется
      const startContainer = async (): Promise<void> => {
        for (let attempt = 0; ; attempt += 1) {
          try {
            execFileSync('docker', ['start', containerName], { stdio: 'pipe' });
            return;
          } catch (error) {
            if (attempt >= 4) {
              throw error;
            }
            await sleep(500);
          }
        }
      };
      // timeout 1 — быстрая остановка без десятисекундного grace period
      await postgres.stop({ remove: false, timeout: 1 });
      try {
        const lead = new LeadEntity(generateLeadId(), 'DB outage', 'db-outage@test.local', 'hello');
        await request(gatewayApp.getHttpServer()).post('/api/v1/leads').send(lead).expect(201);

        const job = await waitFor(
          async (): Promise<Job<SendLeadJob> | undefined> => {
            const jobs = await leadsQueue.getJobs(['failed']);
            return jobs.find(
              (entry): boolean => entry.data.lead.id === lead.id && entry.data.channel === ChannelEnum.DATABASE,
            );
          },
          20_000,
          'database job failed',
        );

        // Остановка контейнера снимает проброс порта: соединения отклоняются мгновенно,
        // все три попытки исчерпываются быстрее, чем истечёт таймаут соединения пула
        expect(job.attemptsMade).toBe(3);
        expect(job.failedReason).toContain('postgres failed');
      } finally {
        await startContainer();
        errors.mockRestore();
      }

      // Пул Prisma после остановки контейнера держит мёртвые соединения: пересоздаём его
      // и ждём готовности postgres, пережидая отказы, пока контейнер поднимается
      await waitFor(
        async (): Promise<number | false> => {
          try {
            await prisma.$disconnect();
            await prisma.$connect();
            return await prisma.lead.count();
          } catch {
            return false;
          }
        },
        30_000,
        'postgres accepting connections',
      );
      const { lead: recovered } = await postLead('db-recovery');

      await waitFor(
        () => prisma.lead.findFirst({ where: { contact: recovered.contact } }),
        10_000,
        'database row saved after recovery',
      );
    });
  });
}
