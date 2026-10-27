import type { MinimalJob } from 'bullmq';

import { causeChain } from '../../../common/infrastructure/cause-chain';
import { LeadDeliveryException } from '../../application/exceptions/lead-delivery.exception';

/**
 * Пауза перед повтором задачи доставки: настроенная задержка, удваиваемая с каждой
 * попыткой, но не меньше той, о которой попросил получатель (Telegram 429 `retry_after`,
 * HTTP `Retry-After`). Иначе попытки исчерпываются раньше, чем получатель восстановится.
 */
export function leadBackoffStrategy(
  attemptsMade: number,
  _type: string | undefined,
  error: Error | undefined,
  job: Pick<MinimalJob, 'opts'> | undefined,
): number {
  const { backoff } = job?.opts ?? {};
  const delay = typeof backoff === 'number' ? backoff : (backoff?.delay ?? 0);

  // attemptsMade у первого повтора равен 1: он ждёт ровно настроенную задержку
  return Math.max(delay * 2 ** (attemptsMade - 1), retryAfterMsOf(error) ?? 0);
}

function retryAfterMsOf(error: Error | undefined): number | undefined {
  for (const cause of causeChain(error)) {
    if (cause instanceof LeadDeliveryException) {
      return cause.retryAfterMs;
    }
  }

  return undefined;
}
