import { InfrastructureException, ModuleEnum } from '@leads-router/common';

export interface HttpDeliveryFailure {
  endpoint: string;
  status?: number;
  code?: string;
  retryable: boolean;
}

export class HttpLeadDeliveryException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;
  public readonly details: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(
    private readonly failures: readonly HttpDeliveryFailure[],
    private readonly totalEndpoints: number,
  ) {
    super();
    this.retryable = failures.some((failure): boolean => failure.retryable);
    this.details = { failedEndpoints: failures.map((failure): string => failure.endpoint), totalEndpoints, failures };
  }

  override get message(): string {
    return `Lead delivery failed for ${this.failures.length.toString()} of ${this.totalEndpoints.toString()} HTTP endpoint(s)`;
  }
}
