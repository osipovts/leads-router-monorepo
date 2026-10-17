import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailClientModule } from './email-client/email-client.module';
import { EmailLeadDeliveryAdapter } from './email-lead-delivery.adapter';
import { emailLeadDeliveryConfig } from './email-lead-delivery.config';

@Module({
  imports: [ConfigModule.forFeature(emailLeadDeliveryConfig), EmailClientModule],
  providers: [EmailLeadDeliveryAdapter],
  exports: [EmailLeadDeliveryAdapter],
})
export class EmailLeadDeliveryModule {}
