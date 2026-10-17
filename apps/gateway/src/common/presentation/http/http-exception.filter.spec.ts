import { LayerEnum, ModuleEnum } from '@leads-router/common';
import { BadRequestException, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { HttpExceptionFilter } from './http-exception.filter';

interface TestResponse {
  json: jest.Mock<unknown, [unknown]>;
  status: jest.Mock<TestResponse, [number]>;
}

function createHost(): { host: ExecutionContextHost; status: TestResponse['status']; json: TestResponse['json'] } {
  const response: TestResponse = {
    json: jest.fn<unknown, [unknown]>(),
    status: jest.fn<TestResponse, [number]>(),
  };
  response.status.mockReturnValue(response);
  const host = new ExecutionContextHost([{ method: 'POST', url: '/api/v1/leads' }, response]);

  return { host, status: response.status, json: response.json };
}

// Ответы 4xx записываются на уровне warn без стека; ответы 5xx — на уровне error со стеком.
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
