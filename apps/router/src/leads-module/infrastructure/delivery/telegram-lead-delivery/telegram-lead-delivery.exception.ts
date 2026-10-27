import { TelegramApiError, TelegramBotError } from 'node-telegram-bot-api';

import { causeChain } from '../../../../common/infrastructure/cause-chain';
import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableTelegramError } from './is-retryable-telegram-error';
import { telegramRetryAfterMs } from './telegram-retry-after';

export class TelegramLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;
  public override readonly retryAfterMs: number | undefined;
  public override readonly details: Record<string, unknown> | undefined;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableTelegramError(cause);
    this.retryAfterMs = telegramRetryAfterMs(cause);
    this.details = telegramFailureDetails(cause);
  }

  override get message(): string {
    return 'Lead delivery via telegram failed';
  }
}

/**
 * Детали попадают в failedReason задачи: ответ Telegram (код и описание вроде
 * «bot was blocked by the user») или код транспортной ошибки SDK.
 */
function telegramFailureDetails(error: unknown): Record<string, unknown> | undefined {
  for (const cause of causeChain(error)) {
    if (cause instanceof TelegramApiError) {
      return { errorCode: cause.errorCode, description: cause.description };
    }
    if (cause instanceof TelegramBotError) {
      return { code: cause.code };
    }
  }

  return undefined;
}
