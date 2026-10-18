import { isTransientError, TelegramApiError } from 'node-telegram-bot-api';

/**
 * Telegram-доставка повторяема при преходящих ошибках API (перегрузка, сбои сети);
 * постоянные ответы повтора не изменят.
 */
export function isRetryableTelegramError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);

    if (current instanceof TelegramApiError) {
      return isTransientError(current);
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return true;
}
