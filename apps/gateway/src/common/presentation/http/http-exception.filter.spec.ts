import { LayerEnum, ModuleEnum } from '@leads-router/common';
import type { ArgumentsHost} from '@nestjs/common';
import { BadRequestException, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

function createHost(): { host: ArgumentsHost; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/api/v1/leads' }),
      getResponse: () => ({ status, json }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

// 4xx - ошибка клиента и логируется warn-ом без стека; 5xx - error со стеком
describe('HttpExceptionFilter', () => {
  let loggerWarn: jest.SpyInstance;
  let loggerError: jest.SpyInstance;
  let filter: HttpExceptionFilter;

  beforeAll(() => {
    loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    loggerWarn.mockRestore();
    loggerError.mockRestore();
  });

  beforeEach(() => {
    loggerWarn.mockClear();
    loggerError.mockClear();
    filter = new HttpExceptionFilter();
  });

  it('responds with the error dto and logs a client error as warn without stack', () => {
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        layer: LayerEnum.PRESENTATION,
        module: ModuleEnum.COMMON,
        error: 'BadRequestException',
        message: 'Bad Request',
      },
    });
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledWith('POST /api/v1/leads: Bad Request');
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('logs a server error as error with stack', () => {
    const { host, status, json } = createHost();

    filter.catch(new ServiceUnavailableException('queue is down'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        layer: LayerEnum.PRESENTATION,
        module: ModuleEnum.COMMON,
        error: 'ServiceUnavailableException',
        message: 'queue is down',
      },
    });
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledWith('POST /api/v1/leads: queue is down', expect.any(String));
    expect(loggerWarn).not.toHaveBeenCalled();
  });
});
