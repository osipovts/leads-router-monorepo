import type { ValidationPipeOptions } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'

export class HttpValidationPipe extends ValidationPipe {
  constructor(
    options: ValidationPipeOptions = {
      transform: true,
      forbidNonWhitelisted: true,
      whitelist: true,
    },
  ) {
    super(options)
  }
}
