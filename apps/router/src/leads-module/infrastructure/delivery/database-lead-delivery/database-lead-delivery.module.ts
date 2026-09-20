import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseClientModule } from './database-client/database-client.module';
import { DatabaseLeadDeliveryAdapter } from './database-lead-delivery.adapter';
import { databaseLeadDeliveryConfig } from './database-lead-delivery.config';

@Module({
  imports: [ConfigModule.forFeature(databaseLeadDeliveryConfig), DatabaseClientModule],
  providers: [DatabaseLeadDeliveryAdapter],
  exports: [DatabaseLeadDeliveryAdapter],
})
export class DatabaseLeadDeliveryModule {}
