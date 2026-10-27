import { bullmqConfig, type BullmqConfigType } from '@leads-router/common';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

import { RateLimiterUnavailableException } from './rate-limiter-unavailable.exception';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const KEY_PREFIX = 'throttler:';

// Счётчик фиксированного окна и блокировка меняются одним скриптом: параллельные запросы
// с нескольких реплик gateway не проскакивают между INCR и установкой блокировки
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, ttl, 1, tonumber(ARGV[3]) }
end
return { hits, ttl, 0, 0 }
`;

/**
 * Хранилище лимита запросов в Redis: реплики gateway делят один лимит на клиента.
 * Окно фиксированное (отсчитывается от первого запроса), а не скользящее, как в памяти.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(@Inject(bullmqConfig.KEY) config: BullmqConfigType) {
    // Те же ограничения, что у соединения очереди: при потере Redis запрос не ждёт его возвращения
    this.redis = new Redis({
      ...config.connection,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
      commandTimeout: 5_000,
    });
    // Ошибки соединения уже логирует слушатель очереди; без обработчика ioredis пишет их в stderr сам
    this.redis.on('error', (): void => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `${KEY_PREFIX}${throttlerName}:${key}`;
    try {
      const reply: unknown = await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        hitsKey,
        `${hitsKey}:blocked`,
        ttl,
        limit,
        blockDuration,
      );

      return toRecord(reply);
    } catch (error: unknown) {
      // Без Redis лид всё равно не попадёт в очередь, поэтому запрос сразу получает 503.
      // Пропуск к очереди добавил бы к ожиданию лимитера ещё один таймаут команды Redis
      throw new RateLimiterUnavailableException(error);
    }
  }

  // quit() без соединения отклоняется, а ioredis продолжает переподключаться и держит процесс.
  // Незавершённых записей у счётчика лимита не бывает, поэтому соединение просто закрывается
  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}

// Throttler ждёт сроки в секундах, Redis отдаёт миллисекунды
function toRecord(reply: unknown): ThrottlerStorageRecord {
  if (!Array.isArray(reply) || !reply.every((value: unknown): value is number => typeof value === 'number')) {
    throw new Error(`Unexpected throttler script reply: ${JSON.stringify(reply)}`);
  }
  const [totalHits, ttlMs, isBlocked, blockTtlMs] = reply;

  return {
    totalHits,
    timeToExpire: Math.ceil(ttlMs / 1_000),
    isBlocked: isBlocked === 1,
    timeToBlockExpire: Math.ceil(blockTtlMs / 1_000),
  };
}
