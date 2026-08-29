import { Module } from '@nestjs/common';

import { CreateLeadUseCase } from './application/use-cases/create-lead.use-case';
import { LeadsController } from './presentation/http/leads.controller';

@Module({
  controllers: [LeadsController],
  providers: [CreateLeadUseCase],
})
export class LeadsModule {}
