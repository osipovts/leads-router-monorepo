import z from 'zod';

const enabledSchema = z.stringbool().default(false);

/**
 * Читает *_ENABLED-флаг адаптера доставки; отсутствие переменной трактуется как выключенный сервис.
 *
 * Контракт: пока флаг выключен, конфиг-фабрика адаптера и его клиента возвращает стаб вместо
 * парсинга схемы, поэтому сервисные переменные (токены, пароли, хосты) не валидируются
 * и могут вообще не задаваться в env.
 */
export function isDeliveryEnabled(enabledVar: string | undefined): boolean {
  return enabledSchema.parse(enabledVar);
}
