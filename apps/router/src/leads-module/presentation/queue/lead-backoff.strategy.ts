import type { MinimalJob } from 'bullmq';

import { causeChain } from '../../../common/infrastructure/cause-chain';
import { LeadDeliveryException } from '../../application/exceptions/lead-delivery.exception';

/**
 * Пауза перед повтором задачи доставки: настроенная задержка, но не меньше той,
 * о которой попросил получатель (Telegram 429 `retry_after`). Иначе попытки
 * исчерпываются раньше, чем получатель снова начнёт принимать запросы.
 */
export function leadBackoffStrategy(
  _attemptsMade: number,
  _type: string | undefined,
  error: Error | undefined,
  job: Pick<MinimalJob, 'opts'> | undefined,
): number {
  const { backoff } = job?.opts ?? {};
  const delay = typeof backoff === 'number' ? backoff : (backoff?.delay ?? 0);

  return Math.max(delay, retryAfterMsOf(error) ?? 0);
}

function retryAfterMsOf(error: Error | undefined): number | undefined {
  for (const cause of causeChain(error)) {
    if (cause instanceof LeadDeliveryException) {
      return cause.retryAfterMs;
    }
  }

  return undefined;
}
