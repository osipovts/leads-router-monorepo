import { ModuleEnum } from '../enums';
import { DomainException } from '../exceptions';

export class InvalidLeadException extends DomainException {
  public readonly module = ModuleEnum.COMMON;
  public readonly details: Record<string, unknown>;

  constructor(violations: Record<string, string>) {
    super();
    this.details = { violations };
  }

  override get message(): string {
    return 'Lead entity fields violate their constraints';
  }
}
