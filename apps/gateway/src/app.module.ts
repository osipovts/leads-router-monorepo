import { bullmqConfig, type BullmqConfigType } from '@leads-router/common';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { swaggerConfig } from './common/infrastructure/swagger.config';
import { leadsQueueConfig } from './leads-module/leads.config';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig, swaggerConfig, bullmqConfig, leadsQueueConfig] }),
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
