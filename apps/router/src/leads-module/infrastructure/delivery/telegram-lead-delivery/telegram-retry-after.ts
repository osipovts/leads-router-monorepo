import { TelegramApiError } from 'node-telegram-bot-api';

import { causeChain } from '../../../../common/infrastructure/cause-chain';

/**
 * Пауза, которую Telegram просит выдержать перед повтором (429 `retry_after`, в секундах).
 */
export function telegramRetryAfterMs(error: unknown): number | undefined {
  for (const cause of causeChain(error)) {
    if (cause instanceof TelegramApiError) {
      return cause.retryAfter === undefined ? undefined : cause.retryAfter * 1_000;
    }
  }

  return undefined;
}
