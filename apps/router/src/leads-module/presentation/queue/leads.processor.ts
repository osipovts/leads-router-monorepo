import { Exception, LeadEntity, QUEUES, type SendLeadJob } from '@leads-router/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';

import { SendLeadUseCase } from '../../application/use-cases/send-lead.use-case';

@Processor(QUEUES.LEADS.QUEUE_NAME)
export class LeadsProcessor extends WorkerHost {
  constructor(private readonly sendLeadUseCase: SendLeadUseCase) {
    super();
  }

  async process(job: Job<SendLeadJob>): Promise<void> {
    switch (job.name) {
      case QUEUES.LEADS.JOBS.SEND: {
        let lead: LeadEntity;

        try {
          lead = LeadEntity.from(job.data.lead);
        } catch (error: unknown) {
          // Битый payload не станет валидным после ретрая - фейлим джобу сразу
          throw new UnrecoverableError(JSON.stringify(Exception.toJSON(error)));
        }

        await this.sendLeadUseCase.execute(job.data.channel, lead);
        return;
      }

      default:
        throw new UnrecoverableError(`Unsupported job '${job.name}'`);
    }
  }
}
