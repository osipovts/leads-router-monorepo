import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HttpClient } from './http-client/http.client';
import { httpClientConfig } from './http-client/http-client.config';
import { HttpClientModule } from './http-client/http-client.module';
import { HttpLeadDeliveryAdapter } from './http-lead-delivery.adapter';
import { httpLeadDeliveryConfig } from './http-lead-delivery.config';

@Module({
  imports: [
    ConfigModule.forFeature(httpLeadDeliveryConfig),
    ConfigModule.forFeature(httpClientConfig),
    HttpClientModule,
  ],
  providers: [HttpLeadDeliveryAdapter, HttpClient],
  exports: [HttpLeadDeliveryAdapter],
})
export class HttpLeadDeliveryModule {}
