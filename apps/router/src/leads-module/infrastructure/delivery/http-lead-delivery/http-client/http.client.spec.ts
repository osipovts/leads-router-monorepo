import { Logger } from '@nestjs/common';
import axios, { type AxiosAdapter, AxiosError } from 'axios';

import { HttpClient } from './http.client';

describe('HttpClient retries', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('honors Retry-After on a POST with a 429 response', async (): Promise<void> => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation((): void => undefined);
    let attempts = 0;
    const adapter: AxiosAdapter = (config): ReturnType<AxiosAdapter> => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(
          new AxiosError('rate limited', undefined, config, undefined, {
            data: null,
            status: 429,
            statusText: '',
            headers: { 'retry-after': '2' },
            config,
          }),
        );
      }
      return Promise.resolve({ data: { accepted: true }, status: 200, statusText: '', headers: {}, config });
    };
    const instance = axios.create({ adapter });
    jest.spyOn(axios, 'create').mockReturnValue(instance);
    const client = new HttpClient({ timeout: 10_000, retryCount: 1 });
    const request = client.post<unknown>('http://receiver.test/leads', {});

    await jest.advanceTimersByTimeAsync(1_999);
    expect(attempts).toBe(1);
    await jest.advanceTimersByTimeAsync(501);
    await expect(request).resolves.toEqual({ accepted: true });
    expect(attempts).toBe(2);
  });
});

describe('HttpClient redirects', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('creates the axios client without redirect following', (): void => {
    const createSpy = jest.spyOn(axios, 'create');

    new HttpClient({ timeout: 10_000, retryCount: 0 });

    expect(createSpy).toHaveBeenCalledWith({
      timeout: 10_000,
      maxContentLength: 65_536,
      maxRedirects: 0,
    });
  });
});
