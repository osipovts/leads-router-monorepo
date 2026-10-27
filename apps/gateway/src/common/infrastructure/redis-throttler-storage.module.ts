import { bullmqConfig } from '@leads-router/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  imports: [ConfigModule.forFeature(bullmqConfig)],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class RedisThrottlerStorageModule {}
