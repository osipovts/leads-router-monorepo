import type { ChannelEnum } from '@leads-router/common';
import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class EnqueueFailedException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;
  public readonly details: Record<string, unknown>;

  constructor(private readonly failedChannels: readonly ChannelEnum[]) {
    super();
    this.details = { failedChannels };
  }

  override get message(): string {
    return `Lead enqueue failed for channel(s): ${this.failedChannels.join(', ')}`;
  }
}
