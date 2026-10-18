import { randomUUID } from 'node:crypto';

/**
 * Генерация id лида — задача инфраструктуры: домен принимает уже готовый id
 * и остаётся чистым от зависимостей рантайма.
 */
export function generateLeadId(): string {
  return randomUUID();
}
