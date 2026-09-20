import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { LeadDeliveryPort } from '../../../application/ports/lead-delivery.port';
import { DatabaseClient } from './database-client/database.client';
import { databaseLeadDeliveryConfig, type DatabaseLeadDeliveryConfigType } from './database-lead-delivery.config';

@Injectable()
export class DatabaseLeadDeliveryAdapter implements LeadDeliveryPort {
  readonly channel = ChannelEnum.DATABASE;
  private readonly logger = new Logger(DatabaseLeadDeliveryAdapter.name);

  constructor(
    @Inject(databaseLeadDeliveryConfig.KEY) private readonly config: DatabaseLeadDeliveryConfigType,
    private readonly client: DatabaseClient,
  ) {}

  get enabled(): boolean {
    return this.config.ENABLED;
  }

  async send(lead: LeadEntity): Promise<void> {
    this.logger.log(`Saving lead from ${lead.name} <${lead.contact}> to postgres`);
    await this.client.saveLead(lead);
  }
}
