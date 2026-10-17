import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class TelegramLeadDeliveryException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;
  public readonly cause: unknown;

  constructor(cause: unknown) {
    super();
    this.cause = cause;
  }

  override get message(): string {
    return 'Lead delivery via telegram failed';
  }
}
