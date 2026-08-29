import { Body, Controller, Post } from '@nestjs/common';

import { SuccessHttpResponseDto } from '../../../common/presentation/http/http-response.dto';
import { CreateLeadUseCase } from '../../application/use-cases/create-lead.use-case';
import { LeadDto } from './dto/lead.dto';

@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly createLeadUseCase: CreateLeadUseCase) {}

  @Post()
  async post(@Body() req: LeadDto): Promise<SuccessHttpResponseDto<LeadDto>> {
    const result = await this.createLeadUseCase.execute(req);
    return SuccessHttpResponseDto.create(result);
  }
}
