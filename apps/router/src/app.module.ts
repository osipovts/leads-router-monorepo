import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { bullmqConfig, BullmqConfigType } from './common/infrastructure/bullmq.config';
import { PrismaModule } from './common/infrastructure/prisma/prisma.module';
import { httpClientConfig } from './leads-module/infrastructure/delivery/http-lead-delivery/http-client/http-client.config';
import { httpLeadDeliveryConfig } from './leads-module/infrastructure/delivery/http-lead-delivery/http-lead-delivery.config';
import { telegramConfig } from './leads-module/infrastructure/delivery/telegram.config';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig, bullmqConfig, telegramConfig, httpClientConfig, httpLeadDeliveryConfig] }),
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
