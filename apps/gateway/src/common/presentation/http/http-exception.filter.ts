import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
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

    const description = `${request.method} ${request.url}: ${res.error.message}`;

    // 4xx - ошибка клиента, а не приложения: warn без стека, иначе валидационные 400
    // и троттлинг 429 зашумляют error-лог и алерты
    if (status >= HttpStatus.BAD_REQUEST && status < HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.warn(description);
    } else {
      this.logger.error(description, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json(res);
  }
}
