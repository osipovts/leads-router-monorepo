import type { ChannelEnum } from '../application';
import type { LeadEntity } from '../domain';

export interface SendLeadJobPort {
  readonly channel: ChannelEnum;
  readonly lead: LeadEntity;
}
