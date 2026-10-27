import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import type { DeliveryCheckpoint } from '../../../application/ports/lead-delivery.port';
import type { HttpClient } from './http-client/http.client';
import { HttpLeadDeliveryAdapter } from './http-lead-delivery.adapter';
import type { HttpLeadDeliveryConfigType } from './http-lead-delivery.config';
import { HttpLeadDeliveryException } from './http-lead-delivery.exception';
import { isRetryableHttpError } from './is-retryable-http-error';

const makeConfig = (endpoints: readonly string[]): HttpLeadDeliveryConfigType => ({
  enabled: true,
  endpoints: [...endpoints],
});

interface CheckpointFake extends DeliveryCheckpoint {
  markDelivered: jest.MockedFunction<DeliveryCheckpoint['markDelivered']>;
}

const makeCheckpoint = (delivered: readonly string[] = []): CheckpointFake => ({
  delivered: new Set(delivered),
  markDelivered: jest.fn<Promise<void>, [readonly string[]]>().mockResolvedValue(undefined),
});

// Ответ сети имитируется настоящим AxiosError: адаптер читает status и code,
// а классификацию выполняет isRetryableHttpError
const axiosError = (status: number | undefined, code = 'ETIMEDOUT'): AxiosError => {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response: AxiosResponse | undefined =
    status === undefined ? undefined : { status, statusText: '', data: null, headers: {}, config };

  return new AxiosError('request failed', code, config, undefined, response);
};

describe('HttpLeadDeliveryAdapter', (): void => {
  let post: jest.MockedFunction<HttpClient['post']>;

  beforeAll((): void => {
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    jest.restoreAllMocks();
  });

  beforeEach((): void => {
    post = jest.fn();
  });

  it('posts the lead to every configured endpoint', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    post.mockResolvedValue(undefined);
    const adapter = new HttpLeadDeliveryAdapter(makeConfig(['http://one.test/leads', 'http://two.test/leads']), {
      post,
    } as unknown as HttpClient);

    await adapter.send(lead, makeCheckpoint());

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith('http://one.test/leads', lead);
    expect(post).toHaveBeenCalledWith('http://two.test/leads', lead);
  });

  it.each([
    [301, false],
    [400, false],
    [401, false],
    [404, false],
    [422, false],
    [408, true],
    [425, true],
    [429, true],
    [500, true],
    [503, true],
  ])('classifies HTTP %i as isRetryable=%s in the failure details', async (status, isRetryable): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    post.mockRejectedValueOnce(axiosError(status));
    post.mockResolvedValue(undefined);
    const adapter = new HttpLeadDeliveryAdapter(makeConfig(['http://failing.test/leads', 'http://ok.test/leads']), {
      post,
    } as unknown as HttpClient);

    const failing: Promise<void> = adapter.send(lead, makeCheckpoint());

    await expect(failing).rejects.toBeInstanceOf(HttpLeadDeliveryException);
    // Успешный endpoint тоже получил запрос: fan-out не прерывается первым отказом
    expect(post).toHaveBeenCalledTimes(2);

    const caught: unknown = await failing.catch((error: unknown): unknown => error);
    const details = JSON.stringify((caught as HttpLeadDeliveryException).details);
    expect(details).toContain('"endpoint":"http://failing.test/leads"');
    expect(details).toContain(`"status":${status.toString()}`);
    expect(details).toContain(`"isRetryable":${isRetryable ? 'true' : 'false'}`);
  });

  it('keeps endpoint credentials and query values out of the serialized failure', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    post.mockRejectedValue(axiosError(503));
    const adapter = new HttpLeadDeliveryAdapter(
      makeConfig(['https://user:s3cret-pass@failing.test/leads?api_key=s3cret-key']),
      { post } as unknown as HttpClient,
    );

    const caught: unknown = await adapter.send(lead, makeCheckpoint()).catch((error: unknown): unknown => error);

    const serialized = JSON.stringify(caught);
    expect(serialized).toContain('failing.test/leads');
    expect(serialized).not.toContain('s3cret');
  });

  it('marks the delivery retryable while at least one endpoint failed temporarily', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    post.mockRejectedValueOnce(axiosError(400));
    post.mockRejectedValueOnce(axiosError(503));
    const adapter = new HttpLeadDeliveryAdapter(
      makeConfig(['http://permanent.test/leads', 'http://temporary.test/leads']),
      {
        post,
      } as unknown as HttpClient,
    );

    const caught: unknown = await adapter.send(lead, makeCheckpoint()).catch((error: unknown): unknown => error);

    expect((caught as HttpLeadDeliveryException).isRetryable).toBe(true);
  });

  it('marks the delivery permanent when every endpoint failed permanently', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    post.mockRejectedValue(axiosError(404));
    const adapter = new HttpLeadDeliveryAdapter(makeConfig(['http://one.test/leads', 'http://two.test/leads']), {
      post,
    } as unknown as HttpClient);

    const caught: unknown = await adapter.send(lead, makeCheckpoint()).catch((error: unknown): unknown => error);

    expect((caught as HttpLeadDeliveryException).isRetryable).toBe(false);
  });

  it('marks a network error without response as retryable', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    post.mockRejectedValue(axiosError(undefined, 'ECONNREFUSED'));
    const adapter = new HttpLeadDeliveryAdapter(makeConfig(['http://one.test/leads']), {
      post,
    } as unknown as HttpClient);

    const failing: Promise<void> = adapter.send(lead, makeCheckpoint());

    const caught: unknown = await failing.catch((error: unknown): unknown => error);
    expect(caught).toBeInstanceOf(HttpLeadDeliveryException);
    expect((caught as HttpLeadDeliveryException).isRetryable).toBe(true);
    expect(JSON.stringify((caught as HttpLeadDeliveryException).details)).toContain('"code":"ECONNREFUSED"');
  });

  it('keeps a non-axios client error retryable', (): void => {
    expect(isRetryableHttpError(new Error('unexpected client failure'))).toBe(true);
  });

  describe('retry after a partial failure', (): void => {
    const ONE = 'http://one.test/leads';
    const TWO = 'http://two.test/leads';

    const failTwoOnce = (): void => {
      post.mockImplementation((endpoint: string) =>
        endpoint === ONE ? Promise.resolve(undefined) : Promise.reject(axiosError(503)),
      );
    };

    it('skips endpoints that accepted the lead in an earlier attempt', async (): Promise<void> => {
      const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
      const adapter = new HttpLeadDeliveryAdapter(makeConfig([ONE, TWO]), { post } as unknown as HttpClient);
      const firstAttempt = makeCheckpoint();
      failTwoOnce();
      await expect(adapter.send(lead, firstAttempt)).rejects.toBeInstanceOf(HttpLeadDeliveryException);
      post.mockReset();
      post.mockResolvedValue(undefined);

      // Повтор получает ровно то, что сохранила прошлая попытка
      await adapter.send(lead, makeCheckpoint(firstAttempt.markDelivered.mock.calls[0][0]));

      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(TWO, lead);
    });

    it('marks the endpoints that accepted the lead without storing their URLs', async (): Promise<void> => {
      const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
      const adapter = new HttpLeadDeliveryAdapter(
        makeConfig(['https://user:s3cret@one.test/leads?api_key=s3cret', TWO]),
        { post } as unknown as HttpClient,
      );
      const checkpoint = makeCheckpoint();
      post.mockImplementation((endpoint: string) =>
        endpoint === TWO ? Promise.reject(axiosError(503)) : Promise.resolve(undefined),
      );

      await expect(adapter.send(lead, checkpoint)).rejects.toBeInstanceOf(HttpLeadDeliveryException);
      expect(checkpoint.markDelivered).toHaveBeenCalledTimes(1);
      // Отметка уходит в данные задачи в Redis: секреты из URL туда не попадают
      const [marked] = checkpoint.markDelivered.mock.calls[0];
      expect(marked).toHaveLength(1);
      expect(JSON.stringify(marked)).not.toContain('s3cret');
    });

    it('does not write a checkpoint when every endpoint accepted the lead', async (): Promise<void> => {
      const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
      post.mockResolvedValue(undefined);
      const adapter = new HttpLeadDeliveryAdapter(makeConfig([ONE, TWO]), { post } as unknown as HttpClient);
      const checkpoint = makeCheckpoint();

      await adapter.send(lead, checkpoint);

      expect(checkpoint.markDelivered).not.toHaveBeenCalled();
    });
  });
});
