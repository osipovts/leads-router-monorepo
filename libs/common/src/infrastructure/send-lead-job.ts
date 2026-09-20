import type { ChannelEnum } from '../application';
import type { LeadEntity } from '../domain';

export interface SendLeadJob {
  readonly channel: ChannelEnum;
  readonly lead: LeadEntity;
}
