import { createServer } from 'node:net';

import { RateLimiterUnavailableException } from './rate-limiter-unavailable.exception';
import { RedisThrottlerStorage } from './redis-throttler.storage';

// Порт, на котором гарантированно никто не слушает: сервер занимает его и сразу освобождает
const closedPort = (): Promise<number> =>
  new Promise((resolve, reject): void => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', (): void => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close((): void => {
        resolve(port);
      });
    });
  });

describe('RedisThrottlerStorage', (): void => {
  it('rejects the request as a temporary outage while Redis is unreachable', async (): Promise<void> => {
    const storage = new RedisThrottlerStorage({
      connection: { host: '127.0.0.1', port: await closedPort(), password: undefined },
    });

    try {
      await expect(storage.increment('client', 60_000, 1, 60_000, 'default')).rejects.toBeInstanceOf(
        RateLimiterUnavailableException,
      );
    } finally {
      storage.onApplicationShutdown();
    }
  });
});
