import type { PlainObject } from '@leads-router/common';
import {
  ExceptionInterface,
  LayerEnum,
  ModuleEnum,
} from '@leads-router/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Success http response:
 * {
 *   success: true,
 *   data: { ... }
 * }
 *
 * Error http response:
 * {
 *   success: false,
 *   error: {
 *     module: 'EXAMPLE',
 *     layer: 'APPLICATION',
 *     error: 'EntityNotFoundException',
 *     message: 'Entity ExampleEntity with id ... not found',  
 *   }
 * }
 */

// Base response
export abstract class HttpResponseDto {
  @ApiProperty({ type: Boolean })
  abstract success: boolean;
}

// Success response
export class SuccessHttpResponseDto<T extends object> extends HttpResponseDto {
  @ApiProperty({ enum: [true], example: true })
  override success = true;

  @ApiProperty({ type: Object })
  data!: T;

  static create<T extends object>(data: T): SuccessHttpResponseDto<T> {
    return {
      success: true,
      data,
    };
  }
}

// Error response
export class ErrorDto implements ExceptionInterface {
  @ApiProperty({ enum: ModuleEnum })
  declare module: ModuleEnum;

  @ApiProperty({ enum: LayerEnum })
  declare layer: LayerEnum;

  @ApiProperty()
  declare error: string;

  @ApiProperty()
  declare message: string;

  @ApiProperty({ required: false })
  declare details?: PlainObject;
}

export class ErrorHttpResponseDto<T extends ErrorDto> extends HttpResponseDto {
  @ApiProperty({ enum: [false], example: false })
  override success = false;

  @ApiProperty({ type: Object })
  error!: T;

  static fromJSON<T extends ErrorDto>(error: T): ErrorHttpResponseDto<T> {
    return {
      success: false,
      error,
    };
  }
}
