import { LeadEntity } from '@leads-router/common';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { SuccessHttpResponseDto } from '../../../common/presentation/http/http-response.dto';
import {
  ApiQueueUnavailableErrorResponse,
  ApiValidationErrorResponse,
} from '../../../common/presentation/http/swagger-error-response.decorator';
import { BroadcastLeadUseCase } from '../../application/use-cases/broadcast-lead.use-case';
import { LeadRequestDto } from './dto/lead-request.dto';

@Controller({ path: 'leads', version: '1' })
export class BroadcastLeadsController {
  constructor(private readonly broadcastLeadUseCase: BroadcastLeadUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Рассылает лид по всем доступным каналам' })
  @ApiValidationErrorResponse()
  @ApiQueueUnavailableErrorResponse()
  async post(@Body() req: LeadRequestDto): Promise<SuccessHttpResponseDto<LeadRequestDto>> {
    const lead = new LeadEntity(req.name, req.contact, req.message);
    await this.broadcastLeadUseCase.execute(lead);
    return SuccessHttpResponseDto.create(req);
  }
}
