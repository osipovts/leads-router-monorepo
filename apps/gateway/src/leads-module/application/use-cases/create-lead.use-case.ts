import { Injectable } from '@nestjs/common';

import { LeadEntityInterface } from '../../domain/lead.entity';

@Injectable()
export class CreateLeadUseCase {
  async execute(leadEntity: LeadEntityInterface): Promise<LeadEntityInterface> {
    return Promise.resolve(leadEntity);
  }
}
