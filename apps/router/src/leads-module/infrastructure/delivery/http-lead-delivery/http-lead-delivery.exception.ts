import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export class HttpLeadDeliveryException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;
  public readonly details: Record<string, unknown>;

  constructor(
    private readonly failedEndpoints: readonly string[],
    private readonly totalEndpoints: number,
  ) {
    super();
    this.details = { failedEndpoints, totalEndpoints };
  }

  override get message(): string {
    return `Lead delivery failed for ${this.failedEndpoints.length.toString()} of ${this.totalEndpoints.toString()} HTTP endpoint(s)`;
  }
}
