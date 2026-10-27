import { causeChain } from '../../../../common/infrastructure/cause-chain';
import { Prisma } from '../../../../common/infrastructure/prisma/generated/client';
import { LeadDeliveryException } from '../../../application/exceptions/lead-delivery.exception';
import { isRetryableDatabaseError } from './is-retryable-database-error';

export class DatabaseLeadDeliveryException extends LeadDeliveryException {
  public readonly cause: unknown;
  public readonly isRetryable: boolean;
  public override readonly details: Record<string, unknown> | undefined;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
    this.isRetryable = isRetryableDatabaseError(cause);
    this.details = databaseFailureDetails(cause);
  }

  override get message(): string {
    return 'Lead delivery to postgres failed';
  }
}

/**
 * Детали попадают в failedReason задачи: код Prisma (P2000, P1001) или сетевой код pg.
 * Сообщение ошибки не берётся — Prisma может включать в него значения полей лида.
 */
function databaseFailureDetails(error: unknown): Record<string, unknown> | undefined {
  for (const cause of causeChain(error)) {
    if (cause instanceof Prisma.PrismaClientInitializationError && cause.errorCode !== undefined) {
      return { code: cause.errorCode };
    }
    if ('code' in cause && typeof cause.code === 'string') {
      return { code: cause.code };
    }
  }

  return undefined;
}
