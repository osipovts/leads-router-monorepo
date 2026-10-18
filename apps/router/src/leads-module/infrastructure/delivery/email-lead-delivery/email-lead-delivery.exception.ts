import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableEmailError } from './is-retryable-email-error';

export class EmailLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableEmailError(cause);
  }

  override get message(): string {
    return 'Lead delivery via email failed';
  }
}
