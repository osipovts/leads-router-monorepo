import { isTransientError, TelegramApiError } from 'node-telegram-bot-api';

import { causeChain } from '../../../../common/infrastructure/cause-chain';

/**
 * Telegram-доставка повторяема при преходящих ошибках API (перегрузка, сбои сети);
 * постоянные ответы повтора не изменят.
 */
export function isRetryableTelegramError(error: unknown): boolean {
  for (const cause of causeChain(error)) {
    if (cause instanceof TelegramApiError) {
      return isTransientError(cause);
    }
  }

  return true;
}
