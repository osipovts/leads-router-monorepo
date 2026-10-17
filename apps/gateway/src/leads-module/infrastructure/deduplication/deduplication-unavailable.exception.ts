import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class DeduplicationUnavailableException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;

  override get message(): string {
    return 'Lead deduplication store is temporarily unavailable';
  }
}
