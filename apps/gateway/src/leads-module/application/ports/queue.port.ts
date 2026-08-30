import type { LeadEntityInterface } from '../../domain/lead.entity';

export const QUEUE_PORT = 'QUEUE_PORT';

export interface QueuePort {
  createLead(lead: LeadEntityInterface, attempts: number, backoff: number): Promise<LeadEntityInterface>;
}
