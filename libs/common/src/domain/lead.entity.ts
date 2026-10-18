import { InvalidLeadException } from './invalid-lead.exception';

/**
 * Данные лида для передачи через очередь и восстановления сущности.
 */
export interface LeadPayload {
  readonly id: string;
  readonly name: string;
  readonly contact: string;
  readonly message: string;
}

export class LeadEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly contact: string,
    public readonly message: string,
  ) {
    // Данные из очереди проверяются во время выполнения: их типы могут отличаться от объявленных.
    const fields: Array<[field: string, value: unknown, limits: LeadFieldLimits]> = [
      ['id', id, LeadEntityValidation.id],
      ['name', name, LeadEntityValidation.name],
      ['contact', contact, LeadEntityValidation.contact],
      ['message', message, LeadEntityValidation.message],
    ];

    const violations: Record<string, string> = {};

    for (const [field, value, limits] of fields) {
      const violation = LeadEntity.validateField(value, limits);

      if (violation !== undefined) {
        violations[field] = violation;
      }
    }

    if (Object.keys(violations).length > 0) {
      throw new InvalidLeadException(violations);
    }
  }

  toString(): string {
    return `From: ${this.name} <${this.contact}>\nMessage: ${this.message}`;
  }

  static from(payload: LeadPayload): LeadEntity {
    return new LeadEntity(payload.id, payload.name, payload.contact, payload.message);
  }

  private static validateField(value: unknown, limits: LeadFieldLimits): string | undefined {
    if (typeof value !== 'string') {
      return 'must be a string';
    }

    const length = Array.from(value).length;

    if (limits.minLength !== undefined && length < limits.minLength) {
      return `must be at least ${limits.minLength.toString()} character(s) long`;
    }

    if (limits.maxLength !== undefined && length > limits.maxLength) {
      return `must be at most ${limits.maxLength.toString()} character(s) long`;
    }

    if (!limits.pattern.test(value)) {
      return limits.patternViolation;
    }

    return undefined;
  }
}

interface LeadFieldLimits {
  minLength?: number;
  maxLength?: number;
  pattern: RegExp;
  patternViolation: string;
}

export const LeadEntityValidation = Object.freeze({
  // id используется для дедупликации задач и защиты от повторной вставки в БД.
  // Данные лида без id не проходят проверку.
  id: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    patternViolation: 'must be a valid UUID',
  },
  // Управляющие символы (\p{Cc}) запрещены; в message разрешён перевод строки.
  // Поле name используется в теме письма, поэтому CR и LF в нём запрещены.
  name: {
    minLength: 1,
    maxLength: 64,
    pattern: /^[^\p{Cc}]*$/u,
    patternViolation: 'must not contain control characters',
  },
  contact: {
    minLength: 1,
    maxLength: 128,
    pattern: /^[^\p{Cc}]*$/u,
    patternViolation: 'must not contain control characters',
  },
  message: {
    minLength: 1,
    maxLength: 2048,
    // Из управляющих символов разрешён только LF.
    pattern: /^(?:[^\p{Cc}]|\n)*$/u,
    patternViolation: 'must not contain control characters',
  },
});
