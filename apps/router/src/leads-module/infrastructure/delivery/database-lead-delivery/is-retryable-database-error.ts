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
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);

    if (current instanceof Prisma.PrismaClientKnownRequestError) {
      return !PERMANENT_DATABASE_ERROR_CODES.has(current.code);
    }
    if (current instanceof Prisma.PrismaClientInitializationError && current.errorCode !== undefined) {
      return !PERMANENT_DATABASE_ERROR_CODES.has(current.errorCode);
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return true;
}
