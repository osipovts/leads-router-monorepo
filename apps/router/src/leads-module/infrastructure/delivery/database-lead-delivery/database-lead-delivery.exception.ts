import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class DatabaseLeadDeliveryException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;
  public readonly cause: unknown;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
  }

  override get message(): string {
    return 'Lead delivery to postgres failed';
  }
}
