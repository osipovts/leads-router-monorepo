import type { ChannelEnum, LeadEntity } from '@leads-router/common';

export const LEAD_DELIVERY_ADAPTERS = Symbol('LEAD_DELIVERY_ADAPTERS');

/**
 * Отметка о доставке, переживающая повторы задачи. Нужна каналам с несколькими адресатами:
 * при частичном сбое повтор отправляет лид только тем, кто его ещё не принял.
 */
export interface DeliveryCheckpoint {
  /** Адресаты, принявшие лид в прошлых попытках */
  readonly delivered: ReadonlySet<string>;
  /** Сохраняет адресатов, принявших лид в этой попытке, до её завершения с ошибкой */
  markDelivered(destinations: readonly string[]): Promise<void>;
}

export interface LeadDeliveryPort {
  readonly channel: ChannelEnum;
  readonly enabled: boolean;
  send(lead: LeadEntity, checkpoint: DeliveryCheckpoint): Promise<void>;
}
