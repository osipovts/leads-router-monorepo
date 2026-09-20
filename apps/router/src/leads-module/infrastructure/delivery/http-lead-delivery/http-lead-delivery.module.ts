import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HttpClientModule } from './http-client/http-client.module';
import { HttpLeadDeliveryAdapter } from './http-lead-delivery.adapter';
import { httpLeadDeliveryConfig } from './http-lead-delivery.config';

@Module({
  imports: [ConfigModule.forFeature(httpLeadDeliveryConfig), HttpClientModule],
  providers: [HttpLeadDeliveryAdapter],
  exports: [HttpLeadDeliveryAdapter],
})
export class HttpLeadDeliveryModule {}
