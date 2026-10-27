import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class RateLimiterUnavailableException extends InfrastructureException {
  public readonly module = ModuleEnum.COMMON;
  public readonly cause: unknown;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
  }

  override get message(): string {
    return 'Rate limiter is temporarily unavailable';
  }
}
