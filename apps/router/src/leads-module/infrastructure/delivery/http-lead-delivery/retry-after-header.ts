import axios from 'axios';

const DELAY_SECONDS = /^\d+$/;

/**
 * Пауза из заголовка Retry-After ответа (RFC 9110): число секунд или HTTP-date.
 * Нечитаемое значение игнорируется — тогда паузу выбирает очередь.
 */
export function retryAfterHeaderMs(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  const value: unknown = error.response?.headers['retry-after'];
  if (typeof value !== 'string') {
    return undefined;
  }
  if (DELAY_SECONDS.test(value)) {
    return Number(value) * 1_000;
  }

  const date = Date.parse(value);

  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
