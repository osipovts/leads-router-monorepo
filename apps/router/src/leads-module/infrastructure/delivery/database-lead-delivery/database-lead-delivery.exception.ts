import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableDatabaseError } from './is-retryable-database-error';

export class DatabaseLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableDatabaseError(cause);
  }

  override get message(): string {
    return 'Lead delivery to postgres failed';
  }
}
