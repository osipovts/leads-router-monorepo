import { QUEUES, SendLeadJobPort } from '@leads-router/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { SendLeadUseCase } from '../../application/use-cases/send-lead.use-case';

@Processor(QUEUES.LEADS.QUEUE_NAME)
export class LeadsProcessor extends WorkerHost {
  constructor(private readonly sendLeadUseCase: SendLeadUseCase) {
    super();
  }

  async process(job: Job<SendLeadJobPort>): Promise<void> {
    switch (job.name) {
      case QUEUES.LEADS.JOBS.SEND:
        await this.sendLeadUseCase.execute(job.data.channel, job.data.lead);
        return;

      default:
        throw new Error(`Unsupported job '${job.name}'`);
    }
  }
}
