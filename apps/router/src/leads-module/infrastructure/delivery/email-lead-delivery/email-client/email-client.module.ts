import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailClient } from './email.client';
import { emailClientConfig } from './email-client.config';

@Module({
  imports: [ConfigModule.forFeature(emailClientConfig)],
  providers: [EmailClient],
  exports: [EmailClient],
})
export class EmailClientModule {}
