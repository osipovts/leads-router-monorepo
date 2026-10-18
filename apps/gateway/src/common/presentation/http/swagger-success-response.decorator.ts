import { applyDecorators, type Type } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

import { SuccessHttpResponseDto } from './http-response.dto';

/**
 * Документирует 201 с конвертом SuccessHttpResponseDto вокруг модели данных.
 * Композиция allOf нужна потому, что дженерик конверта стирается в рантайме
 * и data задекларирован как object.
 */
export function ApiSuccessCreatedResponse(dataModel: Type<object>, description: string): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(SuccessHttpResponseDto, dataModel),
    ApiCreatedResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessHttpResponseDto) },
          { properties: { data: { $ref: getSchemaPath(dataModel) } } },
        ],
      },
    }),
  );
}
