import { createHash } from 'node:crypto';

/**
 * Идентификатор эндпоинта без его секретов: SHA-256 от URL. Им эндпоинт отмечается
 * в данных задачи (Redis) и опознаётся в логах, а сам URL с учётными данными и
 * ключами в query остаётся только в конфиге.
 */
export function endpointKey(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}
