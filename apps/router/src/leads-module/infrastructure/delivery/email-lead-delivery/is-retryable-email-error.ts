import { causeChain } from '../../../../common/infrastructure/cause-chain';

/**
 * SMTP-доставка повторяема при преходящих отказах сервера (4xx-класс почтового
 * диалога); постоянные ошибки вроде 550 или неверных учётных данных не исправить повтором.
 */
export function isRetryableEmailError(error: unknown): boolean {
  for (const cause of causeChain(error)) {
    if ('responseCode' in cause && typeof cause.responseCode === 'number') {
      return cause.responseCode < 500;
    }
    if ('code' in cause && cause.code === 'EAUTH') {
      return false;
    }
  }

  return true;
}
