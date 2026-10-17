import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const handlerName = `${context.getClass().name}#${context.getHandler().name}()`;
    const description = `${handlerName}: ${request.method} ${request.originalUrl}`;

    this.logger.debug(`--> ${description}`);
    response.once('finish', (): void => {
      this.logger.debug(
        `<-- ${description} status=${response.statusCode.toString()} duration=${(Date.now() - startedAt).toString()}ms`,
      );
    });

    return next.handle();
  }
}
