import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { SuccessHttpResponseDto } from '../../../common/presentation/http/http-response.dto';
import { QUEUE_PORT, QueuePort } from '../../application/ports/queue.port';
import { QueueUnavailableException } from '../../infrastructure/queue/queue-unavailable.exception';

/**
 * Проверка готовности для healthcheck контейнера: gateway жив, пока может ставить лиды в очередь.
 * Лимит запросов не применяется: он сам ходит в Redis, а проверка опрашивается постоянно.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(QUEUE_PORT) private readonly queue: QueuePort) {}

  @Get()
  get(): SuccessHttpResponseDto<{ status: 'ok' }> {
    if (!this.queue.isReady()) {
      throw new QueueUnavailableException();
    }

    return SuccessHttpResponseDto.create({ status: 'ok' });
  }
}
