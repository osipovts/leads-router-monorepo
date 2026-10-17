import type { LeadEntity } from '@leads-router/common';
import { Inject, Logger } from '@nestjs/common';

import { Prisma } from '../../../../../common/infrastructure/prisma/generated/client';
import { PrismaRepository } from '../../../../../common/infrastructure/prisma/prisma.repository';
import { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';

export class DatabaseClient extends PrismaRepository {
  private readonly logger = new Logger(DatabaseClient.name);

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  async saveLead(lead: LeadEntity): Promise<void> {
    try {
      await this.execute(() =>
        this.prisma.lead.create({
          data: {
            // Первичный ключ сохраняет id лида и защищает от повторной вставки
            // при повторной обработке задачи.
            id: lead.id,
            name: lead.name,
            contact: lead.contact,
            message: lead.message,
          },
        }),
      );
    } catch (error: unknown) {
      if (this.isDuplicateLeadError(error)) {
        this.logger.log(`Lead ${lead.id} is already saved, skipping duplicate insert`);
        return;
      }

      throw error;
    }
  }

  private isDuplicateLeadError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
