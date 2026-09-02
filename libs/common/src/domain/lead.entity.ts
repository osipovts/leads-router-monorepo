export class LeadEntity {
  constructor(
    public readonly name: string,
    public readonly contact: string,
    public readonly message: string,
  ) {}

  toString(): string {
    return `From: ${this.name} <${this.contact}>\nMessage: ${this.message}`;
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
