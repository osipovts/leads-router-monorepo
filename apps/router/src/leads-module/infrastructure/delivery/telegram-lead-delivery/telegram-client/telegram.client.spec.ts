import { Logger } from '@nestjs/common';

import { TelegramClient } from './telegram.client';

// Регрессия: Bot валидирует токен в конструкторе, а NestJS инстанцирует TelegramClient даже при
// выключенной доставке — тогда конфиг по контракту isDeliveryEnabled отдаёт пустой токен.
// Клиент обязан переживать такую сборку
describe('TelegramClient', () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterAll(() => {
    loggerErrorSpy.mockRestore();
  });

  it('is constructible with the empty token of a disabled adapter', () => {
    expect(() => new TelegramClient({ token: '' })).not.toThrow();
  });

  it('rejects sendMessage with an empty token only at call time', async () => {
    const client = new TelegramClient({ token: '' });

    await expect(client.sendMessage('193166758', 'lead text')).rejects.toThrow(/bot token is required/i);
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
