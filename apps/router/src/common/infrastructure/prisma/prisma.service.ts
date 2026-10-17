import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client';
import type { PrismaConfigType } from './prisma.config';
import { prismaConfig } from './prisma.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(prismaConfig.KEY) private readonly config: PrismaConfigType) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleInit(): Promise<void> {
    // При отключённой доставке в БД DATABASE_URL может отсутствовать.
    // Соединение не открывается; адаптер пропускает отправку лида.
    if (!this.config.enabled) {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.$disconnect();
  }
}
