import type { ChannelEnum } from '@leads-router/common';
import { ApplicationException, ModuleEnum } from '@leads-router/common';

export class UnsupportedLeadChannelException extends ApplicationException {
  public readonly module = ModuleEnum.LEADS;

  constructor(private readonly channel: ChannelEnum) {
    super();
  }

  override get message(): string {
    return `Lead delivery adapter for channel '${this.channel}' is not registered`;
  }
}
