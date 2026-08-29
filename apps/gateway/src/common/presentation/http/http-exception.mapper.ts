import type { ExceptionInterface } from '@leads-router/common';
import {
  ApplicationException,
  DomainException,
  Exception,
  InfrastructureException,
  LayerEnum,
  ModuleEnum,
} from '@leads-router/common';
import { HttpException, HttpStatus } from '@nestjs/common';

export interface HttpExceptionMapping {
  status: HttpStatus;
  error: ExceptionInterface;
}

export function mapHttpException(exception: unknown): HttpExceptionMapping {
  if (exception instanceof DomainException) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      error: exception.toJSON(),
    };
  }

  if (exception instanceof ApplicationException) {
    return { status: HttpStatus.BAD_REQUEST, error: exception.toJSON() };
  }

  if (exception instanceof InfrastructureException) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: internalServerError(),
    };
  }

  if (exception instanceof HttpException) {
    return {
      status: exception.getStatus(),
      error: {
        layer: LayerEnum.INFRASTRUCTURE,
        module: ModuleEnum.COMMON,
        error: exception.constructor.name,
        message: httpExceptionMessage(exception),
      },
    };
  }

  if (exception instanceof Exception) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: internalServerError(),
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    error: internalServerError(),
  };
}

function httpExceptionMessage(exception: HttpException): string {
  const response: unknown = exception.getResponse();

  if (typeof response === 'string') {
    return response;
  }

  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const message: unknown = response.message;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }

  return exception.message;
}

function internalServerError(): ExceptionInterface {
  return {
    layer: LayerEnum.UNKNOWN,
    module: ModuleEnum.UNKNOWN,
    error: 'InternalServerError',
    message: 'Internal Server Error',
  };
}
