import type { ChannelEnum, LeadEntity } from '@leads-router/common';

export const QUEUE_PORT = 'QUEUE_PORT';

export interface QueuePort {
  /** Очередь подключена и примет лид без ожидания Redis */
  isReady(): boolean;
  sendLead(channel: ChannelEnum, lead: LeadEntity): Promise<void>;
}
