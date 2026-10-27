import { generateLeadId, LeadEntity } from '@leads-router/common';
import { Logger } from '@nestjs/common';

import { Prisma } from '../../../../../common/infrastructure/prisma/generated/client';
import { DatabaseUnavailableException } from '../../../../../common/infrastructure/prisma/prisma.exceptions';
import type { PrismaService } from '../../../../../common/infrastructure/prisma/prisma.service';
import { DatabaseClient } from './database.client';

describe('DatabaseClient', (): void => {
  let create: jest.MockedFunction<PrismaService['lead']['create']>;

  beforeAll((): void => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation((): void => undefined);
  });

  afterAll((): void => {
    jest.restoreAllMocks();
  });

  beforeEach((): void => {
    create = jest.fn();
  });

  const makeClient = (): DatabaseClient => new DatabaseClient({ lead: { create } } as unknown as PrismaService);

  it('inserts the lead row', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    create.mockResolvedValue({} as never);
    const client = makeClient();

    await client.saveLead(lead);

    expect(create).toHaveBeenCalledWith({
      data: { id: lead.id, name: lead.name, contact: lead.contact, message: lead.message },
    });
  });

  it('skips a duplicate primary key instead of failing the delivery', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    const client = makeClient();

    await expect(client.saveLead(lead)).resolves.toBeUndefined();
  });

  it('maps an initialization failure to the unavailability exception', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    create.mockRejectedValue(new Prisma.PrismaClientInitializationError('cannot reach the server', 'test', 'P1001'));
    const client = makeClient();

    await expect(client.saveLead(lead)).rejects.toBeInstanceOf(DatabaseUnavailableException);
  });

  it('rethrows unrelated request failures as is', async (): Promise<void> => {
    const lead = new LeadEntity(generateLeadId(), 'Иван', 'ivan@example.com', 'hello');
    const failure = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: 'test',
    });
    create.mockRejectedValue(failure);
    const client = makeClient();

    await expect(client.saveLead(lead)).rejects.toBe(failure);
  });
});
