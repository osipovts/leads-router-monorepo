import { endpointKey } from './endpoint-key';

/**
 * URL для логов и ошибок задач: остаётся только origin, а путь, query и учётные данные
 * отбрасываются — в любом из них может лежать секрет (токен вебхука в пути, ключ API в query).
 * Эндпоинты одного хоста различаются по префиксу их endpointKey.
 */
export function redactUrl(url: string): string {
  const origin = URL.parse(url)?.origin ?? '***';

  return `${origin} [${endpointKey(url).slice(0, 12)}]`;
}
