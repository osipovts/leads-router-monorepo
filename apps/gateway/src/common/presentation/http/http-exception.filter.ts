import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { mapHttpException } from './http-exception.mapper';
import { ErrorHttpResponseDto } from './http-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const { status, error } = mapHttpException(exception);
    const res = ErrorHttpResponseDto.fromJSON(error);

    this.logger.error(
      `${request.method} ${request.url}: ${res.error.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(res);
  }
}
