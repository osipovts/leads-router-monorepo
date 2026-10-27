import type { MinimalJob } from 'bullmq';
import { TelegramApiError } from 'node-telegram-bot-api';

import { TelegramLeadDeliveryException } from '../../infrastructure/delivery/telegram-lead-delivery/telegram-lead-delivery.exception';
import { leadBackoffStrategy } from './lead-backoff.strategy';

function jobWithBackoffDelay(delay: number): Pick<MinimalJob, 'opts'> {
  return { opts: { backoff: { type: 'lead', delay } } };
}

// Воркер бросает в BullMQ обёртку над исключением доставки, как LeadsProcessor.process
function workerError(cause: unknown): Error {
  return new Error('Lead delivery failed', { cause });
}

describe('leadBackoffStrategy', (): void => {
  it('waits the configured delay when the failure carries no retry hint', (): void => {
    const error = workerError(new TelegramLeadDeliveryException(new TelegramApiError(502, 'Bad Gateway')));

    expect(leadBackoffStrategy(1, 'lead', error, jobWithBackoffDelay(5_000))).toBe(5_000);
  });

  it('waits as long as the recipient asked when that exceeds the configured delay', (): void => {
    const error = workerError(
      new TelegramLeadDeliveryException(new TelegramApiError(429, 'Too Many Requests', { retry_after: 60 })),
    );

    expect(leadBackoffStrategy(1, 'lead', error, jobWithBackoffDelay(5_000))).toBe(60_000);
  });

  it('keeps the configured delay when the recipient asks for a shorter wait', (): void => {
    const error = workerError(
      new TelegramLeadDeliveryException(new TelegramApiError(429, 'Too Many Requests', { retry_after: 1 })),
    );

    expect(leadBackoffStrategy(1, 'lead', error, jobWithBackoffDelay(5_000))).toBe(5_000);
  });

  it('reads a delay given as a plain number of milliseconds', (): void => {
    expect(leadBackoffStrategy(1, 'lead', new Error('boom'), { opts: { backoff: 5_000 } })).toBe(5_000);
  });

  it('falls back to the requested wait when the job has no configured delay', (): void => {
    const error = workerError(
      new TelegramLeadDeliveryException(new TelegramApiError(429, 'Too Many Requests', { retry_after: 2 })),
    );

    expect(leadBackoffStrategy(1, 'lead', error, { opts: {} })).toBe(2_000);
    expect(leadBackoffStrategy(1, 'lead', error, undefined)).toBe(2_000);
  });

  it('waits the configured delay for an unknown failure', (): void => {
    expect(leadBackoffStrategy(1, 'lead', new Error('boom'), jobWithBackoffDelay(5_000))).toBe(5_000);
  });
});
