import { InfrastructureException, ModuleEnum } from '@leads-router/common';

/**
 * Базовый контракт ошибок доставки: адаптер сам классифицирует свою вендорскую
 * ошибку в момент throw, а воркер читает только флаг и не знает о SDK адаптеров.
 */
export abstract class LeadDeliveryException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;

  abstract readonly isRetryable: boolean;
}
