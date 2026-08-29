import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { LeadsModule } from './leads-module/leads.module';

@Module({
  imports: [ConfigModule.forRoot({ load: [appConfig] }), LeadsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
