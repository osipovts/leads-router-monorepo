import { DomainException, ModuleEnum } from '@leads-router/common';

export class QueueUnavailableException extends DomainException {
  public readonly module = ModuleEnum.LEADS;
  get message(): string {
    return `Queue service temporarly unavailable`;
  }
}
