import { DomainException, ModuleEnum } from '@leads-router/common';

export class QueueUnavailableException extends DomainException {
  public readonly module = ModuleEnum.LEADS;

  override get message(): string {
    return `Queue service temporarly unavailable`;
  }
}
