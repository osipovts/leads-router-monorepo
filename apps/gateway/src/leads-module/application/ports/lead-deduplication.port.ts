export const LEAD_DEDUPLICATION_PORT = 'LEAD_DEDUPLICATION_PORT';

export interface LeadDeduplicationPort {
  /**
   * true - лид видят впервые, false - маркер уже стоит (повторная доставка/запрос).
   */
  tryAcquire(id: string): Promise<boolean>;

  /**
   * Снимает маркер: вызывается при неудачной постановке в очередь, чтобы повтор запроса
   * с тем же id дошёл до каналов.
   */
  release(id: string): Promise<void>;
}
