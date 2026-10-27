import type { ChannelEnum } from '../application';
import type { LeadPayload } from '../domain';

export interface SendLeadJob {
  readonly channel: ChannelEnum;
  readonly lead: LeadPayload;
  /**
   * Адресаты канала, принявшие лид в прошлых попытках задачи (например, HTTP endpoint'ы).
   * Gateway поле не задаёт; router дописывает его перед повтором, чтобы не доставлять лид повторно.
   */
  readonly deliveredDestinations?: readonly string[];
}
