/**
 * SMTP-доставка повторяема при преходящих отказах сервера (4xx-класс почтового
 * диалога); постоянные ошибки вроде 550 или неверных учётных данных не исправить повтором.
 */
export function isRetryableEmailError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);

    if ('responseCode' in current && typeof current.responseCode === 'number') {
      return current.responseCode < 500;
    }
    if ('code' in current && current.code === 'EAUTH') {
      return false;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return true;
}
