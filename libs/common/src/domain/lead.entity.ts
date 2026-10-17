import { randomUUID } from 'node:crypto';

import { InvalidLeadException } from './invalid-lead.exception';

/**
 * POJO-форма лида: в таком виде сущность сериализуется в очередь доставки и восстанавливается из неё.
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
    // Значения проверяются как unknown: payload приходит из очереди и мог быть повреждён
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

  static generate(name: string, contact: string, message: string): LeadEntity {
    return new LeadEntity(randomUUID(), name, contact, message);
  }

  private static validateField(value: unknown, limits: LeadFieldLimits): string | undefined {
    if (typeof value !== 'string') {
      return 'must be a string';
    }

    if (limits.minLength !== undefined && value.length < limits.minLength) {
      return `must be at least ${limits.minLength.toString()} character(s) long`;
    }

    if (limits.maxLength !== undefined && value.length > limits.maxLength) {
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
  // id - основа идемпотентности: по нему gateway дедуплицирует повторы, а database-адаптер
  // пропускает повторную вставку, поэтому payloads без id считаются невалидными
  id: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    patternViolation: 'must be a valid UUID',
  },
  // Control-символы (\p{Cc}) запрещены во всех полях, кроме перевода строки в message:
  // name попадает в заголовок письма, и CRLF в нём - это header injection
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
    // Единственный разрешённый control-символ - перевод строки
    pattern: /^(?:[^\p{Cc}]|\n)*$/u,
    patternViolation: 'must not contain control characters',
  },
});
