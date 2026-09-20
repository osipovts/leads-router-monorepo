import type { LeadEntity } from '@leads-router/common';
import { Inject } from '@nestjs/common';

import { PrismaRepository } from '../../../../../common/infrastructure/prisma/prisma.repository';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';

export class DatabaseClient extends PrismaRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  async saveLead(lead: LeadEntity): Promise<void> {
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
