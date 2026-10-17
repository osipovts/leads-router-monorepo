import type { LeadEntity } from '@leads-router/common';
import { LeadEntityValidation } from '@leads-router/common';
import { ApiProperty } from '@nestjs/swagger';

export class LeadResponseDto {
  @ApiProperty({
    description: 'Идентификатор лида: передавайте его же при повторе запроса, чтобы сработала дедупликация',
  })
  declare id: string;

  @ApiProperty({ ...LeadEntityValidation.name, pattern: LeadEntityValidation.name.pattern.source })
  declare name: string;

  @ApiProperty({ ...LeadEntityValidation.contact, pattern: LeadEntityValidation.contact.pattern.source })
  declare contact: string;

  @ApiProperty({ ...LeadEntityValidation.message, pattern: LeadEntityValidation.message.pattern.source })
  declare message: string;

  static from(lead: LeadEntity): LeadResponseDto {
    return { id: lead.id, name: lead.name, contact: lead.contact, message: lead.message };
  }
}
