import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { redactUrl } from './redact-url';

export interface HttpDeliveryFailure {
  endpoint: string;
  status?: number;
  code?: string;
  isRetryable: boolean;
}

export class HttpLeadDeliveryException extends LeadDeliveryException {
  public readonly details: Record<string, unknown>;
  public readonly isRetryable: boolean;

  constructor(
    private readonly failures: readonly HttpDeliveryFailure[],
    private readonly totalEndpoints: number,
  ) {
    super();
    this.isRetryable = failures.some((failure): boolean => failure.isRetryable);
    // details попадают в failedReason задачи и логи: секреты из URL эндпоинта маскируются
    const redacted = failures.map((failure): HttpDeliveryFailure => ({
      ...failure,
      endpoint: redactUrl(failure.endpoint),
    }));
    this.details = {
      failedEndpoints: redacted.map((failure): string => failure.endpoint),
      totalEndpoints,
      failures: redacted,
    };
  }

  override get message(): string {
    return `Lead delivery failed for ${this.failures.length.toString()} of ${this.totalEndpoints.toString()} HTTP endpoint(s)`;
  }
}
