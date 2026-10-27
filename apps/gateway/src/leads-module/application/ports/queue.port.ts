import type { ChannelEnum, LeadEntity } from '@leads-router/common';

export const QUEUE_PORT = 'QUEUE_PORT';

export interface QueuePort {
  sendLead(channel: ChannelEnum, lead: LeadEntity): Promise<void>;
}
