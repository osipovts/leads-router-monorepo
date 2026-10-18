import http from 'node:http';

export interface RecordedRequest {
  url: string | undefined;
  body: unknown;
}

export interface HttpSink {
  port: number;
  requests: RecordedRequest[];
  /** Максимум запросов, обрабатывавшихся сервером одновременно */
  maxConcurrent: number;
  close(): Promise<void>;
}

export interface HttpSinkResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpSinkOptions {
  respond?: (request: RecordedRequest) => HttpSinkResponse;
  /** Задержка ответа в мс: синк удерживает соединение, чтобы фиксировать параллельные доставки */
  delayMs?: number;
}

/**
 * Локальный HTTP-сервер записывает запросы адаптера доставки.
 * Тест проверяет полученные данные через requests и может задать ответ серверу.
 */
export function startHttpSink(options: HttpSinkOptions = {}): Promise<HttpSink> {
  const requests: RecordedRequest[] = [];
  let inFlight = 0;
  let maxConcurrent = 0;

  const server = http.createServer((req, res): void => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);

    let raw = '';
    req.on('data', (chunk: string): void => {
      raw += chunk;
    });
    req.on('end', (): void => {
      // Тело может не быть JSON: разбор терпит неудачу, но запрос записывается,
      // а сервер отвечает 400 вместо обрыва соединения без ответа
      let body: unknown;
      try {
        body = raw.length > 0 ? (JSON.parse(raw) as unknown) : null;
      } catch {
        body = raw;
      }

      const recorded: RecordedRequest = { url: req.url, body };
      requests.push(recorded);

      const respond = (): void => {
        const response: HttpSinkResponse =
          typeof recorded.body === 'string' ? { status: 400 } : (options.respond?.(recorded) ?? { status: 200 });
        res.writeHead(response.status, { 'Content-Type': 'text/plain', ...response.headers });
        res.end(response.body ?? 'ok');
        inFlight -= 1;
      };

      if (options.delayMs !== undefined) {
        setTimeout(respond, options.delayMs);
        return;
      }

      respond();
    });
  });

  return new Promise((resolve, reject): void => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', (): void => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('HTTP sink has no TCP address'));
        return;
      }
      resolve({
        port: address.port,
        requests,
        get maxConcurrent(): number {
          return maxConcurrent;
        },
        close: (): Promise<void> =>
          new Promise((done): void => {
            server.close((): void => {
              done();
            });
          }),
      });
    });
  });
}
