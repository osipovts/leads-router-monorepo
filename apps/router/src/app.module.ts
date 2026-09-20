import { bullmqConfig, type BullmqConfigType } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { PrismaModule } from './common/infrastructure/prisma/prisma.module';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig] }),
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(bullmqConfig)],
      inject: [bullmqConfig.KEY],
      useFactory: (config: BullmqConfigType) => ({ connection: config.connection }),
    }),
    LeadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
