import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { appConfig } from './app.config';
import { BULLMQ_CONFIG, bullmqConfig, BullmqConfigType } from './common/infrastructure/bullmq.config';
import { swaggerConfig } from './common/infrastructure/swagger.config';
import { leadsQueueConfig } from './leads-module/leads.config';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig, swaggerConfig, bullmqConfig, leadsQueueConfig] }),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(appConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { connection } = configService.getOrThrow<BullmqConfigType>(BULLMQ_CONFIG);
        return { connection };
      },
    }),
    LeadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
