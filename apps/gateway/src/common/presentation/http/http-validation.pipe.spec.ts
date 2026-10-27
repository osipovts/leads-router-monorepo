import { type ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';

import { HttpValidationPipe } from './http-validation.pipe';

class SampleDto {
  @IsString()
  declare name: string;
}

const BODY: ArgumentMetadata = { type: 'body', metatype: SampleDto };

describe('HttpValidationPipe', () => {
  const pipe = new HttpValidationPipe();

  it('turns a valid body into an instance of the DTO', async (): Promise<void> => {
    const result: unknown = await pipe.transform({ name: 'Иван' }, BODY);

    expect(result).toBeInstanceOf(SampleDto);
    expect(result).toEqual({ name: 'Иван' });
  });

  it('rejects a body with a field the DTO does not declare', async (): Promise<void> => {
    const error: unknown = await pipe.transform({ name: 'Иван', role: 'admin' }, BODY).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error instanceof BadRequestException && error.getResponse()).toMatchObject({
      message: ['property role should not exist'],
    });
  });

  it('rejects a body that violates the DTO constraints', async (): Promise<void> => {
    await expect(pipe.transform({ name: 42 }, BODY)).rejects.toBeInstanceOf(BadRequestException);
  });
});
