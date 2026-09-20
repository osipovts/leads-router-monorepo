import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { ErrorDto, ErrorHttpResponseDto } from './http-response.dto';

const errorResponseSchema = {
  allOf: [
    { $ref: getSchemaPath(ErrorHttpResponseDto) },
    {
      properties: {
        error: { $ref: getSchemaPath(ErrorDto) },
      },
    },
  ],
};

export function ApiValidationErrorResponse(): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ErrorHttpResponseDto, ErrorDto),
    ApiBadRequestResponse({
      description: 'Тело запроса не прошло валидацию',
      content: {
        'application/json': {
          schema: errorResponseSchema,
          examples: {
            validationError: {
              summary: 'Поле name слишком короткое',
              value: {
                success: false,
                error: {
                  layer: 'INFRASTRUCTURE',
                  module: 'COMMON',
                  error: 'BadRequestException',
                  message: 'name must be longer than or equal to 2 characters',
                },
              },
            },
          },
        },
      },
    }),
  );
}

export function ApiTooManyRequestsErrorResponse(): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ErrorHttpResponseDto, ErrorDto),
    ApiTooManyRequestsResponse({
      description: 'Превышен лимит запросов с этого IP',
      content: {
        'application/json': {
          schema: errorResponseSchema,
          examples: {
            tooManyRequests: {
              summary: 'Слишком много запросов за окно TTL',
              value: {
                success: false,
                error: {
                  layer: 'INFRASTRUCTURE',
                  module: 'COMMON',
                  error: 'ThrottlerException',
                  message: 'ThrottlerException: Too Many Requests',
                },
              },
            },
          },
        },
      },
    }),
  );
}

export function ApiQueueUnavailableErrorResponse(): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ErrorHttpResponseDto, ErrorDto),
    ApiServiceUnavailableResponse({
      description: 'Очередь временно недоступна',
      content: {
        'application/json': {
          schema: errorResponseSchema,
          examples: {
            queueUnavailable: {
              summary: 'Нет соединения с Redis',
              value: {
                success: false,
                error: {
                  layer: 'INFRASTRUCTURE',
                  module: 'LEADS',
                  error: 'QueueUnavailableException',
                  message: 'Queue service is temporarily unavailable',
                },
              },
            },
          },
        },
      },
    }),
  );
}
