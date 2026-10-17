import {
  ApplicationException,
  DomainException,
  InfrastructureException,
  LayerEnum,
  ModuleEnum,
} from '@leads-router/common';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

import { mapHttpException } from './http-exception.mapper';

class TestDomainException extends DomainException {
  public readonly module = ModuleEnum.LEADS;

  override get message(): string {
    return 'lead fields violate constraints';
  }
}

class TestApplicationException extends ApplicationException {
  public readonly module = ModuleEnum.LEADS;

  override get message(): string {
    return 'channel is not registered';
  }
}

class TestInfrastructureException extends InfrastructureException {
  public readonly module = ModuleEnum.LEADS;
  public readonly details: Record<string, unknown> = { failedChannels: ['telegram'] };

  override get message(): string {
    return 'delivery failed';
  }
}

// Слой исключения определяет HTTP-статус: домен 422, приложение 400, инфраструктура 503
describe('mapHttpException', () => {
  it('maps domain exceptions to 422', () => {
    const { status, error } = mapHttpException(new TestDomainException());

    expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error).toEqual({
      layer: LayerEnum.DOMAIN,
      module: ModuleEnum.LEADS,
      error: 'TestDomainException',
      message: 'lead fields violate constraints',
    });
  });

  it('maps application exceptions to 400', () => {
    const { status, error } = mapHttpException(new TestApplicationException());

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(error.layer).toBe(LayerEnum.APPLICATION);
    expect(error.error).toBe('TestApplicationException');
  });

  it('maps infrastructure exceptions to 503 and keeps details', () => {
    const { status, error } = mapHttpException(new TestInfrastructureException());

    expect(status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(error).toEqual({
      layer: LayerEnum.INFRASTRUCTURE,
      module: ModuleEnum.LEADS,
      error: 'TestInfrastructureException',
      message: 'delivery failed',
      details: { failedChannels: ['telegram'] },
    });
  });

  it('maps framework HttpException to its status and the presentation layer', () => {
    const { status, error } = mapHttpException(
      new BadRequestException(['name must be a string', 'contact must be a string']),
    );

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(error.layer).toBe(LayerEnum.PRESENTATION);
    expect(error.error).toBe('BadRequestException');
    expect(error.message).toBe('name must be a string; contact must be a string');
  });

  it('uses the raw string response of an HttpException as its message', () => {
    const { status, error } = mapHttpException(new HttpException('lead is gone', HttpStatus.GONE));

    expect(status).toBe(HttpStatus.GONE);
    expect(error.layer).toBe(LayerEnum.PRESENTATION);
    expect(error.message).toBe('lead is gone');
  });

  it('maps unknown errors to a generic 500 without leaking internals', () => {
    const { status, error } = mapHttpException(new Error('boom'));

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error).toEqual({
      layer: LayerEnum.UNKNOWN,
      module: ModuleEnum.UNKNOWN,
      error: 'InternalServerError',
      message: 'Internal Server Error',
    });
  });

  it('maps non-error throws to a generic 500', () => {
    const { status } = mapHttpException('boom');

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
