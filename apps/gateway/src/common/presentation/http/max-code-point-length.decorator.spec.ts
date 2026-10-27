import { validate } from 'class-validator';

import { MaxCodePointLength } from './max-code-point-length.decorator';

class SampleDto {
  @MaxCodePointLength(3)
  declare value: unknown;
}

async function violationsOf(value: unknown): Promise<string[]> {
  const dto = new SampleDto();
  dto.value = value;
  const errors = await validate(dto);

  return errors.flatMap((error): string[] => Object.values(error.constraints ?? {}));
}

describe('MaxCodePointLength', () => {
  it('accepts a string of exactly max code points', async (): Promise<void> => {
    await expect(violationsOf('abc')).resolves.toEqual([]);
  });

  it('counts astral characters as one code point, not two UTF-16 units', async (): Promise<void> => {
    await expect(violationsOf('😀😀😀')).resolves.toEqual([]);
  });

  it('rejects a string longer than max code points', async (): Promise<void> => {
    await expect(violationsOf('😀😀😀😀')).resolves.toEqual(['value must be shorter than or equal to 3 characters']);
  });

  it('rejects a non-string value', async (): Promise<void> => {
    await expect(violationsOf(123)).resolves.toEqual(['value must be shorter than or equal to 3 characters']);
  });
});
