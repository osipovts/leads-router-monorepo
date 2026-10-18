import { LayerEnum, ModuleEnum } from '../enums';
import { DomainException } from '../exceptions';
import { generateLeadId } from '../infrastructure/lead-id.generator';
import { InvalidLeadException } from './invalid-lead.exception';
import type { LeadPayload } from './lead.entity';
import { LeadEntity, LeadEntityValidation } from './lead.entity';

const VALID = {
  id: '0f14d0ab-9605-4a62-a9e4-5ed26688389b',
  name: 'Иван',
  contact: 'ivan@example.com',
  // Перевод строки в message разрешён; остальные управляющие символы запрещены.
  message: 'Привет!\nВторая строка',
} satisfies LeadPayload;

function invalidOf(overrides: Partial<LeadPayload>): InvalidLeadException {
  try {
    LeadEntity.from({ ...VALID, ...overrides });
  } catch (error: unknown) {
    if (error instanceof InvalidLeadException) {
      return error;
    }

    throw error;
  }

  throw new Error('expected LeadEntity.from to throw InvalidLeadException');
}

function violationsOf(overrides: Partial<LeadPayload>): Record<string, string> {
  return invalidOf(overrides).details.violations;
}

describe('LeadEntity', () => {
  describe('valid payloads', () => {
    it('constructs from a valid payload and exposes fields', () => {
      const lead = LeadEntity.from(VALID);

      expect(lead.id).toBe(VALID.id);
      expect(lead.name).toBe(VALID.name);
      expect(lead.contact).toBe(VALID.contact);
      expect(lead.message).toBe(VALID.message);
    });

    it('renders the delivery text via toString', () => {
      expect(LeadEntity.from(VALID).toString()).toBe(
        `From: ${VALID.name} <${VALID.contact}>\nMessage: ${VALID.message}`,
      );
    });

    it('accepts fields at their exact length limits', () => {
      const atLimits = {
        ...VALID,
        name: 'a'.repeat(64),
        contact: 'c'.repeat(128),
        message: 'm'.repeat(2048),
      } satisfies LeadPayload;

      expect(() => LeadEntity.from(atLimits)).not.toThrow();
    });

    it.each(['😀', '𐐀'])('counts Unicode code points for %s', (character): void => {
      const atLimits = {
        ...VALID,
        name: character.repeat(64),
        contact: character.repeat(128),
        message: character.repeat(2048),
      };

      expect(() => LeadEntity.from(atLimits)).not.toThrow();
      expect(violationsOf({ name: character.repeat(65) }).name).toBe('must be at most 64 character(s) long');
      expect(violationsOf({ contact: character.repeat(129) }).contact).toBe('must be at most 128 character(s) long');
      expect(violationsOf({ message: character.repeat(2049) }).message).toBe('must be at most 2048 character(s) long');
    });

    it('accepts an externally generated UUID id', () => {
      const lead = LeadEntity.from({ id: generateLeadId(), ...VALID });

      expect(lead.id).toMatch(LeadEntityValidation.id.pattern);
      expect(lead.name).toBe(VALID.name);
    });
  });

  describe('field violations', () => {
    it('collects violations of every invalid field at once', () => {
      const violations = violationsOf({ id: 'nope', name: '', contact: '', message: '' });

      expect(Object.keys(violations).sort()).toEqual(['contact', 'id', 'message', 'name']);
    });

    it('rejects a non-UUID id', () => {
      expect(violationsOf({ id: 'not-a-uuid' }).id).toBe(LeadEntityValidation.id.patternViolation);
    });

    it('rejects a missing id', () => {
      expect(violationsOf({ id: undefined }).id).toBe('must be a string');
    });

    it('rejects a non-string field', () => {
      const payload = { ...VALID };
      Reflect.set(payload, 'name', 42);

      expect(violationsOf(payload).name).toBe('must be a string');
    });

    it.each<[keyof LeadPayload, string, string]>([
      ['name', '', 'must be at least 1 character(s) long'],
      ['name', 'a'.repeat(65), 'must be at most 64 character(s) long'],
      ['name', 'bad\rname', 'must not contain control characters'],
      ['name', 'bad\tname', 'must not contain control characters'],
      ['contact', '', 'must be at least 1 character(s) long'],
      ['contact', 'c'.repeat(129), 'must be at most 128 character(s) long'],
      ['contact', 'line\nbreak', 'must not contain control characters'],
      ['message', '', 'must be at least 1 character(s) long'],
      ['message', 'm'.repeat(2049), 'must be at most 2048 character(s) long'],
      ['message', 'carriage\rreturn', 'must not contain control characters'],
    ])('rejects an invalid %s value', (field, value, expected): void => {
      const overrides: Partial<LeadPayload> = { [field]: value };

      expect(violationsOf(overrides)[field]).toBe(expected);
    });
  });

  describe('InvalidLeadException', () => {
    it('carries domain layer, module and per-field violations', () => {
      const error = invalidOf({ name: '' });

      expect(error).toBeInstanceOf(DomainException);
      expect(error.layer).toBe(LayerEnum.DOMAIN);
      expect(error.module).toBe(ModuleEnum.COMMON);
      expect(error.message).toBe('Lead entity fields violate their constraints');
      expect(error.toJSON()).toEqual({
        layer: LayerEnum.DOMAIN,
        module: ModuleEnum.COMMON,
        error: 'InvalidLeadException',
        message: 'Lead entity fields violate their constraints',
        details: { violations: { name: 'must be at least 1 character(s) long' } },
      });
      expect(error.toString()).toBe('[COMMON DOMAIN] InvalidLeadException: Lead entity fields violate their constraints');
    });
  });
});
