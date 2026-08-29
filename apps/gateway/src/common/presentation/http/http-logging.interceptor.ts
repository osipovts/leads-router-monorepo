import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'
import { tap } from 'rxjs'

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const startedAt = Date.now()
    const handlerName = `${context.getClass().name}#${context.getHandler().name}()`
    const requestDescription = this.describeRequest(handlerName, request)

    this.logRequest(requestDescription)

    return next.handle().pipe(
      tap({
        next: () => {
          this.logResponse(requestDescription, response.statusCode, startedAt)
        },
        error: () => {
          this.logResponse(requestDescription, response.statusCode, startedAt)
        },
      }),
    )
  }

  private describeRequest(handlerName: string, request: Request): string {
    return `${handlerName}: ${request.method} ${request.originalUrl}`
  }

  private logRequest(requestDescription: string): void {
    this.logger.debug(`--> ${requestDescription}`)
  }

  private logResponse(requestDescription: string, status: number, startedAt: number): void {
    this.logger.debug(
      `<-- ${requestDescription} status=${status.toString()} duration=${(Date.now() - startedAt).toString()}ms`,
    )
  }
}
