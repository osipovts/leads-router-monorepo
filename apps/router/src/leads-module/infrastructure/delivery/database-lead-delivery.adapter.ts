import { ChannelEnum, type LeadEntity } from '@leads-router/common';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaRepository } from '../../../common/infrastructure/prisma/prisma.repository';
import { PrismaService } from '../../../common/infrastructure/prisma/prisma.service';
import type { LeadDeliveryPort } from '../../application/ports/lead-delivery.port';

@Injectable()
export class DatabaseLeadDeliveryAdapter extends PrismaRepository implements LeadDeliveryPort {
  readonly channel = ChannelEnum.DATABASE;
  private readonly logger = new Logger(DatabaseLeadDeliveryAdapter.name);

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  async send(lead: LeadEntity): Promise<void> {
    this.logger.log(`Saving lead from ${lead.name} <${lead.contact}> to postgres`);
    await this.execute(() =>
      this.prisma.lead.create({
        data: {
          name: lead.name,
          contact: lead.contact,
          message: lead.message,
        },
      }),
    );
  }
}
