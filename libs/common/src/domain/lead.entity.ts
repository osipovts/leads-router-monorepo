import type { SendLeadJob } from '../infrastructure';
import { InvalidLeadException } from './invalid-lead.exception';

export class LeadEntity {
  constructor(
    public readonly name: string,
    public readonly contact: string,
    public readonly message: string,
  ) {
    const fields: Array<[field: string, value: string, limits: LeadFieldLimits]> = [
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

  static fromJob({ lead }: SendLeadJob): LeadEntity {
    const { name, contact, message } = lead;
    return new LeadEntity(name, contact, message);
  }

  private static validateField(value: string, limits: LeadFieldLimits): string | undefined {
    if (value.length < limits.minLength) {
      return `must be at least ${limits.minLength.toString()} character(s) long`;
    }

    if (value.length > limits.maxLength) {
      return `must be at most ${limits.maxLength.toString()} character(s) long`;
    }

    return undefined;
  }
}

interface LeadFieldLimits {
  minLength: number;
  maxLength: number;
}

export const LeadEntityValidation = Object.freeze({
  name: {
    minLength: 1,
    maxLength: 64,
  },
  contact: {
    minLength: 1,
    maxLength: 128,
  },
  message: {
    minLength: 1,
    maxLength: 2048,
  },
});
