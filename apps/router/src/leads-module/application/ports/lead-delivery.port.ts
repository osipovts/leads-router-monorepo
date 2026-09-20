import type { ChannelEnum, LeadEntity } from '@leads-router/common';

export const LEAD_DELIVERY_ADAPTERS = Symbol('LEAD_DELIVERY_ADAPTERS');

export interface LeadDeliveryPort {
  readonly channel: ChannelEnum;
  readonly enabled: boolean;
  send(lead: LeadEntity): Promise<void>;
}
