import axios from 'axios';

/**
 * HTTP-доставка повторяема при сетевом сбое без ответа, таймаутах и перегрузке сервера.
 * 3xx и 4xx — постоянные ошибки: повтор попытки их не изменит.
 */
export function isRetryableHttpError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === undefined || status >= 500 || [408, 425, 429].includes(status);
  }

  // Ошибка не из axios-клиента не квалифицируется: остаётся повторяемой
  return true;
}
