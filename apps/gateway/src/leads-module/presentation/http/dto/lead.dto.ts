import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import {
  LeadEntityInterface,
  LeadEntityValidation,
} from '../../../domain/lead.entity';

export class LeadDto implements LeadEntityInterface {
  @ApiProperty({ ...LeadEntityValidation.name })
  @MaxLength(LeadEntityValidation.name.maxLength)
  @MinLength(LeadEntityValidation.name.minLength)
  @IsString()
  declare name: string;

  @ApiProperty({ ...LeadEntityValidation.contact })
  @MaxLength(LeadEntityValidation.contact.maxLength)
  @MinLength(LeadEntityValidation.contact.minLength)
  @IsString()
  declare contact: string;

  @ApiProperty({ ...LeadEntityValidation.message })
  @MaxLength(LeadEntityValidation.message.maxLength)
  @MinLength(LeadEntityValidation.message.minLength)
  @IsString()
  declare message: string;
}
