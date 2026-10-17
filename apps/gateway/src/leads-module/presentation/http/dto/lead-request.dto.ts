import { LeadEntityValidation } from '@leads-router/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

import { MaxCodePointLength } from '../../../../common/presentation/http/max-code-point-length.decorator';

export class LeadRequestDto {
  @ApiProperty({
    description:
      'UUID лида для идемпотентности: передаётся при повторе запроса или каскадом от другого инстанса; без поля генерируется новый',
    required: false,
    pattern: LeadEntityValidation.id.pattern.source,
  })
  @IsOptional()
  @IsUUID()
  declare id: string | undefined;
  @ApiProperty({ ...LeadEntityValidation.name, pattern: LeadEntityValidation.name.pattern.source })
  @Matches(LeadEntityValidation.name.pattern, { message: 'name must not contain control characters' })
  @MaxCodePointLength(LeadEntityValidation.name.maxLength)
  @MinLength(LeadEntityValidation.name.minLength)
  @IsString()
  declare name: string;

  @ApiProperty({ ...LeadEntityValidation.contact, pattern: LeadEntityValidation.contact.pattern.source })
  @Matches(LeadEntityValidation.contact.pattern, { message: 'contact must not contain control characters' })
  @MaxCodePointLength(LeadEntityValidation.contact.maxLength)
  @MinLength(LeadEntityValidation.contact.minLength)
  @IsString()
  declare contact: string;

  @ApiProperty({ ...LeadEntityValidation.message, pattern: LeadEntityValidation.message.pattern.source })
  @Matches(LeadEntityValidation.message.pattern, { message: 'message must not contain control characters' })
  @MaxCodePointLength(LeadEntityValidation.message.maxLength)
  @MinLength(LeadEntityValidation.message.minLength)
  @IsString()
  declare message: string;
}
