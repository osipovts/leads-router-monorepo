import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { prismaConfig } from './prisma.config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(prismaConfig)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
