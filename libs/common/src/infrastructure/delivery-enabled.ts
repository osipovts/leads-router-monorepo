import z from 'zod';

const enabledSchema = z.stringbool().default(false);

/**
 * Проверяет флаг *_ENABLED адаптера доставки; отсутствие переменной отключает доставку.
 *
 * При выключенной доставке фабрики конфигурации адаптера и клиента возвращают
 * конфигурацию отключённого адаптера без проверки остальных переменных окружения.
 * Токены, пароли и адреса отключённого сервиса могут отсутствовать.
 */
export function isDeliveryEnabled(enabledVar: string | undefined): boolean {
  return enabledSchema.parse(enabledVar);
}
