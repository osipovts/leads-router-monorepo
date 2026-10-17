import { bullmqConfig, type BullmqConfigType } from '@leads-router/common';
import { BullModule, type BullRootModuleOptions } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { appConfig } from './app.config';
import { swaggerConfig } from './common/infrastructure/swagger.config';
import { throttlerConfig, type ThrottlerConfigType } from './common/infrastructure/throttler.config';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig, swaggerConfig] }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule.forFeature(throttlerConfig)],
      inject: [throttlerConfig.KEY],
      useFactory: (config: ThrottlerConfigType) => ({
        throttlers: [{ ttl: config.ttlMs, limit: config.limit }],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(bullmqConfig)],
      inject: [bullmqConfig.KEY],
      useFactory: (config: BullmqConfigType): BullRootModuleOptions => ({
        connection: {
          ...config.connection,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 5_000,
          commandTimeout: 5_000,
        },
      }),
    }),
    LeadsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
