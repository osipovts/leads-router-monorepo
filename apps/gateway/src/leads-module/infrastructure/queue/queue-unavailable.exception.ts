import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class QueueUnavailableException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;

  override get message(): string {
    return `Queue service is temporarily unavailable`;
  }
}
