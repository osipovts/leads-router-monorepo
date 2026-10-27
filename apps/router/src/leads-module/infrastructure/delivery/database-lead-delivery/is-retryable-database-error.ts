import { causeChain } from '../../../../common/infrastructure/cause-chain';
import { Prisma } from '../../../../common/infrastructure/prisma/generated/client';

const PERMANENT_DATABASE_ERROR_CODES = new Set([
  'P1000',
  'P1003',
  'P1010',
  'P1012',
  'P2000',
  'P2002',
  'P2003',
  'P2011',
  'P2025',
]);

/**
 * Доставка в БД повторяема при преходящих сбоях (недоступность, сериализация);
 * постоянные коды Prisma — ошибки схемы и ограничений, повтор их не исправит.
 */
export function isRetryableDatabaseError(error: unknown): boolean {
  for (const cause of causeChain(error)) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError) {
      return !PERMANENT_DATABASE_ERROR_CODES.has(cause.code);
    }
    if (cause instanceof Prisma.PrismaClientInitializationError && cause.errorCode !== undefined) {
      return !PERMANENT_DATABASE_ERROR_CODES.has(cause.errorCode);
    }
  }

  return true;
}
