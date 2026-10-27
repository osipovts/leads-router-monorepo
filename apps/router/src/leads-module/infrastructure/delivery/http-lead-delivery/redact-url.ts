const REDACTED = '***';

/**
 * URL для логов и ошибок задач: учётные данные и значения query (ключи API, токены)
 * заменяются маской, хост и путь остаются, чтобы эндпоинт можно было опознать.
 */
export function redactUrl(url: string): string {
  const parsed = URL.parse(url);
  if (parsed === null) {
    return REDACTED;
  }

  if (parsed.username !== '') {
    parsed.username = REDACTED;
  }
  if (parsed.password !== '') {
    parsed.password = REDACTED;
  }
  for (const key of new Set(parsed.searchParams.keys())) {
    parsed.searchParams.set(key, REDACTED);
  }

  return parsed.toString();
}
