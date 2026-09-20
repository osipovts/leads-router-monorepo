import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  url: string | undefined;
  body: unknown;
}

export interface HttpSink {
  port: number;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

/**
 * Локальный HTTP-синк, записывающий всё, что в него присылают.
 * Используется как эндпоинт для http delivery-адаптера: адаптер делает
 * настоящий POST, а тест контролирует доставку по содержимому `requests`.
 */
export function startHttpSink(): Promise<HttpSink> {
  const requests: RecordedRequest[] = [];

  const server = http.createServer((req, res) => {
    let raw = '';

    req.on('data', (chunk: string) => {
      raw += chunk;
    });

    req.on('end', () => {
      requests.push({ url: req.url, body: raw.length > 0 ? JSON.parse(raw) : null });

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;

      resolve({
        port,
        requests,
        close: () =>
          new Promise((done) => {
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}
