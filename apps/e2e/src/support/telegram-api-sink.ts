export interface TelegramApiCall {
  url: string;
  params: Record<string, string>;
}

export interface TelegramApiSink {
  calls: TelegramApiCall[];
  restore(): void;
}

/**
 * Подменяет globalThis.fetch для запросов к Telegram Bot API и записывает их.
 *
 * TelegramClient использует стандартный адрес api.telegram.org. Подмена fetch
 * позволяет перехватить запросы без изменения настроек приложения.
 * Адаптер, клиент и транспорт библиотеки продолжают обрабатывать данные.
 *
 * Перехват устанавливается до создания Bot: транспорт запоминает fetch в конструкторе.
 */
export function startTelegramApiSink(token: string): TelegramApiSink {
  const calls: TelegramApiCall[] = [];
  const originalFetch = globalThis.fetch;
  const apiPrefix = `https://api.telegram.org/bot${token}/`;

  const stubbedFetch: typeof fetch = async (input, init) => {
    const url = input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url;

    if (!url.startsWith(apiPrefix)) {
      return originalFetch(input, init);
    }

    // В этом сценарии sendMessage не передаёт файлы: тело кодируется как URLSearchParams.
    const rawBody = init?.body;
    const params: Record<string, string> = rawBody instanceof URLSearchParams ? Object.fromEntries(rawBody) : {};

    calls.push({ url, params });

    return new Response(JSON.stringify({ ok: true, result: { message_id: calls.length } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  globalThis.fetch = stubbedFetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
