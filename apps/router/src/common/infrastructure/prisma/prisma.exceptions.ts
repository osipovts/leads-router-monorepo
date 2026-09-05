import { DomainException, ModuleEnum } from '@leads-router/common';

export class DatabaseUnavailableException extends DomainException {
  readonly module = ModuleEnum.COMMON;
  readonly cause: unknown;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
  }

  override get message(): string {
    return 'Database is temporarily unavailable';
  }
}

export const DATABASE_UNAVAILABLE_ERROR_CODES = new Set([
  'P1001',
  'P1002',
  'P1017',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPERM',
]);
