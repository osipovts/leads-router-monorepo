import { LeadEntityValidation } from '@leads-router/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

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
  @MaxLength(LeadEntityValidation.name.maxLength)
  @MinLength(LeadEntityValidation.name.minLength)
  @IsString()
  declare name: string;

  @ApiProperty({ ...LeadEntityValidation.contact, pattern: LeadEntityValidation.contact.pattern.source })
  @Matches(LeadEntityValidation.contact.pattern, { message: 'contact must not contain control characters' })
  @MaxLength(LeadEntityValidation.contact.maxLength)
  @MinLength(LeadEntityValidation.contact.minLength)
  @IsString()
  declare contact: string;

  @ApiProperty({ ...LeadEntityValidation.message, pattern: LeadEntityValidation.message.pattern.source })
  @Matches(LeadEntityValidation.message.pattern, { message: 'message must not contain control characters' })
  @MaxLength(LeadEntityValidation.message.maxLength)
  @MinLength(LeadEntityValidation.message.minLength)
  @IsString()
  declare message: string;
}
