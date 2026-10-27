import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import { Prisma } from '../../../../common/infrastructure/prisma/generated/client';
import { DatabaseUnavailableException } from '../../../../common/infrastructure/prisma/prisma.exceptions';
import type { DatabaseClient } from './database-client/database.client';
import { DatabaseLeadDeliveryAdapter } from './database-lead-delivery.adapter';
import type { DatabaseLeadDeliveryConfigType } from './database-lead-delivery.config';
import { DatabaseLeadDeliveryException } from './database-lead-delivery.exception';

describe('DatabaseLeadDeliveryAdapter', (): void => {
  let saveLead: jest.MockedFunction<DatabaseClient['saveLead']>;

  beforeAll((): void => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    jest.restoreAllMocks();
  });

  beforeEach((): void => {
    saveLead = jest.fn();
  });

  it('saves the lead through the database client', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    saveLead.mockResolvedValue(undefined);
    const adapter = new DatabaseLeadDeliveryAdapter({ enabled: true } satisfies DatabaseLeadDeliveryConfigType, {
      saveLead,
    } as unknown as DatabaseClient);

    await adapter.send(lead);

    expect(saveLead).toHaveBeenCalledWith(lead);
  });

  it('wraps a client failure into the delivery exception', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    const failure = new Error('postgres is down');
    saveLead.mockRejectedValue(failure);
    const adapter = new DatabaseLeadDeliveryAdapter({ enabled: true } satisfies DatabaseLeadDeliveryConfigType, {
      saveLead,
    } as unknown as DatabaseClient);

    const sending: Promise<void> = adapter.send(lead);

    const caught: unknown = await sending.catch((error: unknown): unknown => error);
    expect(caught).toBeInstanceOf(DatabaseLeadDeliveryException);
    expect((caught as DatabaseLeadDeliveryException).cause).toBe(failure);
  });

  it.each([
    ['P2000', false],
    ['P2003', false],
    ['P2034', true],
    ['P2024', true],
  ])('classifies Prisma %s as isRetryable=%s', (code, isRetryable): void => {
    const failure = new Prisma.PrismaClientKnownRequestError('database failed', { code, clientVersion: 'test' });

    expect(new DatabaseLeadDeliveryException(failure).isRetryable).toBe(isRetryable);
  });

  it('does not treat invalid database credentials as a temporary outage', (): void => {
    const failure = new Prisma.PrismaClientInitializationError('authentication failed', 'test', 'P1000');

    expect(new DatabaseLeadDeliveryException(failure).isRetryable).toBe(false);
  });

  it('classifies an unavailability error by its Prisma cause', (): void => {
    const cause = new Prisma.PrismaClientInitializationError('cannot reach the server', 'test', 'P1001');

    expect(new DatabaseLeadDeliveryException(new DatabaseUnavailableException(cause)).isRetryable).toBe(true);
  });

  it('keeps unknown and cyclic causes retryable', (): void => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;

    expect(new DatabaseLeadDeliveryException(new Error('unknown')).isRetryable).toBe(true);
    expect(new DatabaseLeadDeliveryException(cyclic).isRetryable).toBe(true);
  });

  describe('failure details', (): void => {
    it('keeps the Prisma error code', (): void => {
      const failure = new Prisma.PrismaClientKnownRequestError('value too long', {
        code: 'P2000',
        clientVersion: 'test',
      });

      expect(new DatabaseLeadDeliveryException(failure).toJSON().details).toEqual({ code: 'P2000' });
    });

    it('keeps the code of a wrapped unavailability error', (): void => {
      const initialization = new Prisma.PrismaClientInitializationError('cannot reach the server', 'test', 'P1001');
      const network = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

      expect(
        new DatabaseLeadDeliveryException(new DatabaseUnavailableException(initialization)).toJSON().details,
      ).toEqual({ code: 'P1001' });
      expect(new DatabaseLeadDeliveryException(new DatabaseUnavailableException(network)).toJSON().details).toEqual({
        code: 'ECONNREFUSED',
      });
    });

    it('adds no details for an unknown failure', (): void => {
      expect(new DatabaseLeadDeliveryException(new Error('unknown')).toJSON()).not.toHaveProperty('details');
    });
  });
});
