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
 * TelegramClient создаёт Bot без опций, поэтому apiRoot захардкожен в
 * api.telegram.org - единственная точка перехвата без правки продакшн-кода
 * это fetch, который транспорт библиотеки читает из globalThis при создании.
 * Реальный адаптер, клиент и транспорт (кодирование формы, распаковка
 * конверта {ok, result}) при этом работают по-настоящему.
 *
 * Синк нужно установить до бутстрапа router-приложения: транспорт
 * запоминает ссылку на fetch в конструкторе.
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

    // sendMessage идёт без файлов, поэтому тело всегда urlencoded
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
