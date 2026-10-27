import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableTelegramError } from './is-retryable-telegram-error';
import { telegramRetryAfterMs } from './telegram-retry-after';

export class TelegramLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;
  public override readonly retryAfterMs: number | undefined;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableTelegramError(cause);
    this.retryAfterMs = telegramRetryAfterMs(cause);
  }

  override get message(): string {
    return 'Lead delivery via telegram failed';
  }
}
