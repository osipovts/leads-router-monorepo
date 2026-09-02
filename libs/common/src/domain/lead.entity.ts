import type { SendLeadJobPort } from '../infrastructure';

export class LeadEntity {
  constructor(
    public readonly name: string,
    public readonly contact: string,
    public readonly message: string,
  ) {}

  toString(): string {
    return `From: ${this.name} <${this.contact}>\nMessage: ${this.message}`;
  }

  static fromJob({ lead }: SendLeadJobPort): LeadEntity {
    const { name, contact, message } = lead;
    return new LeadEntity(name, contact, message);
  }
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
