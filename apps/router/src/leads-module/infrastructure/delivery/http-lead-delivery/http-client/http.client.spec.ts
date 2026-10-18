import axios from 'axios';

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
});
