import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HEARTBEAT_INTERVAL_MS, WorkerHeartbeat } from './worker-heartbeat';

describe('WorkerHeartbeat', (): void => {
  let dir: string;
  let file: string;
  let healthy: boolean;
  let heartbeat: WorkerHeartbeat;

  // Файл хранит время последнего пульса: его же читает healthcheck контейнера
  const beatAt = async (): Promise<number | undefined> => {
    const content = await readFile(file, 'utf8').catch((): undefined => undefined);
    return content === undefined ? undefined : Number(content);
  };

  beforeEach(async (): Promise<void> => {
    dir = await mkdtemp(join(tmpdir(), 'heartbeat-'));
    file = join(dir, 'router-heartbeat');
    healthy = true;
    heartbeat = new WorkerHeartbeat({ isHealthy: (): boolean => healthy }, { concurrency: 1, heartbeatFile: file });
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(async (): Promise<void> => {
    heartbeat.beforeApplicationShutdown();
    jest.useRealTimers();
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the heartbeat on start and refreshes it while the worker is healthy', async (): Promise<void> => {
    heartbeat.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    const first = await beatAt();

    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(first).toBeDefined();
    expect(await beatAt()).toBeGreaterThan(first ?? Infinity);
  });

  it('stops refreshing the heartbeat while the worker is unhealthy', async (): Promise<void> => {
    heartbeat.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    const last = await beatAt();
    healthy = false;

    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);

    expect(await beatAt()).toBe(last);
  });

  it('does not write the heartbeat for a worker that never became healthy', async (): Promise<void> => {
    healthy = false;
    heartbeat.onApplicationBootstrap();

    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);

    expect(await beatAt()).toBeUndefined();
  });

  it('stops beating on shutdown', async (): Promise<void> => {
    heartbeat.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    const last = await beatAt();

    heartbeat.beforeApplicationShutdown();
    await jest.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);

    expect(await beatAt()).toBe(last);
  });
});
