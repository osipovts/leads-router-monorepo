import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableTelegramError } from './is-retryable-telegram-error';

export class TelegramLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableTelegramError(cause);
  }

  override get message(): string {
    return 'Lead delivery via telegram failed';
  }
}
