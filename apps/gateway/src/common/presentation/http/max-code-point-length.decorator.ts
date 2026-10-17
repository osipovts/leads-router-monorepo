import { buildMessage, MAX_LENGTH, ValidateBy } from 'class-validator';

// JSON Schema и PostgreSQL ограничивают число кодовых точек Unicode, а не длину UTF-16.
export function MaxCodePointLength(max: number): PropertyDecorator {
  return ValidateBy({
    name: MAX_LENGTH,
    constraints: [max],
    validator: {
      validate: (value: unknown): boolean => typeof value === 'string' && Array.from(value).length <= max,
      defaultMessage: buildMessage(
        (prefix: string): string => `${prefix}$property must be shorter than or equal to $constraint1 characters`,
      ),
    },
  });
}
