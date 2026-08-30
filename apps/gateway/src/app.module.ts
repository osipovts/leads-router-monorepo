import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { APP_CONFIG, appConfig, AppConfigType } from './app.config';
import { leadsQueueConfig } from './leads-module/leads.config';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig, leadsQueueConfig] }),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(appConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { bullmq } = configService.getOrThrow<AppConfigType>(APP_CONFIG);
        return { connection: bullmq.connection };
      },
    }),
    LeadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
