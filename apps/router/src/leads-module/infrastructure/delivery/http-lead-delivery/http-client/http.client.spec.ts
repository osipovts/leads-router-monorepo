import { Logger } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import axios, { Axios, AxiosError, AxiosHeaders } from 'axios';

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
      expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('<- POST http://sink.test/leads 503'), {
        code: AxiosError.ERR_BAD_RESPONSE,
        status: 503,
      });
    });

    it('rethrows a network error without a response and logs its code', async (): Promise<void> => {
      const error = new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED');
      request.mockRejectedValue(error);

      await expect(client.post('http://sink.test/leads', {})).rejects.toBe(error);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('<- POST http://sink.test/leads AxiosError: connect ECONNREFUSED'),
        { code: 'ECONNREFUSED', status: undefined },
      );
    });

    it('rethrows a non-axios error and logs its message', async (): Promise<void> => {
      const error = new Error('serializer exploded');
      request.mockRejectedValue(error);

      await expect(client.post('http://sink.test/leads', {})).rejects.toBe(error);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('<- POST http://sink.test/leads UNKNOWN ERROR'),
        'serializer exploded',
      );
    });
  });
});
