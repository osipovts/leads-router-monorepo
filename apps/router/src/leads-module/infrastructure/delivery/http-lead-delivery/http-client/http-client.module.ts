import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HttpClient } from './http.client';
import { httpClientConfig } from './http-client.config';

@Module({
  imports: [ConfigModule.forFeature(httpClientConfig)],
  providers: [HttpClient],
  exports: [HttpClient],
})
export class HttpClientModule {}
