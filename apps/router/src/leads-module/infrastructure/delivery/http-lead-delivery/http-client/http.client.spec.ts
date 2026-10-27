import { Logger } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import axios, { Axios, AxiosError, AxiosHeaders } from 'axios';

import { endpointKey } from '../endpoint-key';
import { redactUrl } from '../redact-url';
import { HttpClient } from './http.client';

describe('HttpClient', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('creates the axios client without redirect following', (): void => {
    const createSpy = jest.spyOn(axios, 'create');

    new HttpClient({ timeout: 10_000 });

    expect(createSpy).toHaveBeenCalledWith({
      timeout: 10_000,
      maxContentLength: 65_536,
      maxRedirects: 0,
    });
  });

  describe('post', (): void => {
    let request: jest.SpiedFunction<InstanceType<typeof Axios>['request']>;
    let loggerError: jest.SpiedFunction<Logger['error']>;
    let client: HttpClient;

    beforeEach((): void => {
      // Экземпляр axios связывает методы прототипа при создании, поэтому подмена — до new HttpClient
      request = jest.spyOn(Axios.prototype, 'request');
      loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
      jest.spyOn(Logger.prototype, 'debug').mockImplementation((): void => undefined);
      client = new HttpClient({ timeout: 10_000 });
    });

    it('sends the body and returns the response data', async (): Promise<void> => {
      request.mockResolvedValue({ status: 200, data: { ok: true } });

      await expect(client.post('http://sink.test/leads', { id: 'lead' })).resolves.toEqual({ ok: true });
      expect(request).toHaveBeenCalledWith({ method: 'POST', url: 'http://sink.test/leads', data: { id: 'lead' } });
    });

    it('rethrows an HTTP error response and logs its status', async (): Promise<void> => {
      const response: AxiosResponse = {
        status: 503,
        statusText: 'Service Unavailable',
        data: null,
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      const error = new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, undefined, undefined, response);
      request.mockRejectedValue(error);

      await expect(client.post('http://sink.test/leads', {})).rejects.toBe(error);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining(`<- POST ${redactUrl('http://sink.test/leads')} 503`),
        {
          code: AxiosError.ERR_BAD_RESPONSE,
          status: 503,
        },
      );
    });

    it('rethrows a network error without a response and logs its code', async (): Promise<void> => {
      const error = new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED');
      request.mockRejectedValue(error);

      await expect(client.post('http://sink.test/leads', {})).rejects.toBe(error);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining(`<- POST ${redactUrl('http://sink.test/leads')} AxiosError: connect ECONNREFUSED`),
        { code: 'ECONNREFUSED', status: undefined },
      );
    });

    it('keeps URL credentials and query values out of the logs', async (): Promise<void> => {
      const loggerDebug = jest.spyOn(Logger.prototype, 'debug').mockImplementation((): void => undefined);
      request.mockRejectedValueOnce(new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED'));
      request.mockResolvedValueOnce({ status: 200, data: null });
      // Вебхуки вроде Slack держат токен в пути, поэтому маскируется и он
      const url = 'https://user:s3cret-pass@sink.test/hooks/s3cret-token?api_key=s3cret-key';

      await expect(client.post(url, {})).rejects.toBeInstanceOf(AxiosError);
      await client.post(url, {});

      const logged = JSON.stringify([...loggerError.mock.calls, ...loggerDebug.mock.calls]);
      // Эндпоинт опознаётся по origin и префиксу его ключа
      expect(logged).toContain(`https://sink.test [${endpointKey(url).slice(0, 12)}]`);
      expect(logged).not.toContain('s3cret');
    });

    it('rethrows a non-axios error and logs its message', async (): Promise<void> => {
      const error = new Error('serializer exploded');
      request.mockRejectedValue(error);

      await expect(client.post('http://sink.test/leads', {})).rejects.toBe(error);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining(`<- POST ${redactUrl('http://sink.test/leads')} UNKNOWN ERROR`),
        'serializer exploded',
      );
    });
  });
});
