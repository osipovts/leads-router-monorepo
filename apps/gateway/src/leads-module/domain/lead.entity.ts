export interface LeadEntityInterface {
  name: string;
  contact: string;
  message: string;
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
