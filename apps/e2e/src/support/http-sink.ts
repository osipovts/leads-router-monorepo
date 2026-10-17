import http from 'node:http';

export interface RecordedRequest {
  url: string | undefined;
  body: unknown;
}

export interface HttpSink {
  port: number;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

export interface HttpSinkResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpSinkOptions {
  respond?: (request: RecordedRequest) => HttpSinkResponse;
}

/**
 * Локальный HTTP-сервер записывает запросы адаптера доставки.
 * Тест проверяет полученные данные через requests и может задать ответ сервера.
 */
export function startHttpSink(options: HttpSinkOptions = {}): Promise<HttpSink> {
  const requests: RecordedRequest[] = [];

  const server = http.createServer((req, res): void => {
    let raw = '';
    req.on('data', (chunk: string): void => {
      raw += chunk;
    });
    req.on('end', (): void => {
      const body: unknown = raw.length > 0 ? JSON.parse(raw) : null;
      const recorded: RecordedRequest = { url: req.url, body };
      requests.push(recorded);
      const response: HttpSinkResponse = options.respond?.(recorded) ?? { status: 200 };
      res.writeHead(response.status, { 'Content-Type': 'text/plain', ...response.headers });
      res.end(response.body ?? 'ok');
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
