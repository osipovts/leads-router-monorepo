import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ConsoleLeadDeliveryAdapter } from './console-lead-delivery.adapter';
import { consoleLeadDeliveryConfig } from './console-lead-delivery.config';

@Module({
  imports: [ConfigModule.forFeature(consoleLeadDeliveryConfig)],
  providers: [ConsoleLeadDeliveryAdapter],
  exports: [ConsoleLeadDeliveryAdapter],
})
export class ConsoleLeadDeliveryModule {}
