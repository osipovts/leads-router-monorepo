import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, ApiOperation, getSchemaPath } from '@nestjs/swagger';

import { SuccessHttpResponseDto } from '../../../common/presentation/http/http-response.dto';
import {
  ApiEnqueueFailedErrorResponse,
  ApiTooManyRequestsErrorResponse,
  ApiValidationErrorResponse,
} from '../../../common/presentation/http/swagger-error-response.decorator';
import { BroadcastLeadUseCase } from '../../application/use-cases/broadcast-lead.use-case';
import { LeadRequestDto } from './dto/lead-request.dto';
import { LeadResponseDto } from './dto/lead-response.dto';

@Controller({ path: 'leads', version: '1' })
export class BroadcastLeadsController {
  constructor(private readonly broadcastLeadUseCase: BroadcastLeadUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Рассылает лид по всем доступным каналам' })
  @ApiExtraModels(SuccessHttpResponseDto, LeadResponseDto)
  @ApiCreatedResponse({
    description: 'Лид принят в очередь доставки по всем каналам',
    schema: {
      allOf: [
        { $ref: getSchemaPath(SuccessHttpResponseDto) },
        { properties: { data: { $ref: getSchemaPath(LeadResponseDto) } } },
      ],
    },
  })
  @ApiValidationErrorResponse()
  @ApiEnqueueFailedErrorResponse()
  @ApiTooManyRequestsErrorResponse()
  async post(@Body() req: LeadRequestDto): Promise<SuccessHttpResponseDto<LeadResponseDto>> {
    const lead = new LeadEntity(req.id ?? generateLeadId(), req.name, req.contact, req.message);

    await this.broadcastLeadUseCase.execute(lead);
    return SuccessHttpResponseDto.create(LeadResponseDto.from(lead));
  }
}
