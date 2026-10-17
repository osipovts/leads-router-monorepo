import type { ChannelEnum } from '../application';
import type { LeadPayload } from '../domain';

export interface SendLeadJob {
  readonly channel: ChannelEnum;
  readonly lead: LeadPayload;
}
