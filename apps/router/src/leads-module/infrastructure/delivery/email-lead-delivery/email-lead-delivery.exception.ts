import { causeChain } from '../../../../common/infrastructure/cause-chain';
import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableEmailError } from './is-retryable-email-error';

export class EmailLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;
  public override readonly details: Record<string, unknown> | undefined;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableEmailError(cause);
    this.details = emailFailureDetails(cause);
  }

  override get message(): string {
    return 'Lead delivery via email failed';
  }
}

/**
 * Детали попадают в failedReason задачи: только коды nodemailer и SMTP. Текст ответа
 * сервера (`response`) не берётся — в нём бывает адрес получателя.
 */
function emailFailureDetails(error: unknown): Record<string, unknown> | undefined {
  for (const cause of causeChain(error)) {
    const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
    const responseCode =
      'responseCode' in cause && typeof cause.responseCode === 'number' ? cause.responseCode : undefined;
    if (code !== undefined || responseCode !== undefined) {
      return { code, responseCode };
    }
  }

  return undefined;
}
