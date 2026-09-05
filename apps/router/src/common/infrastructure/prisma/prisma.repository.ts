import type { PrismaClient } from './generated/client';
import { Prisma } from './generated/client';
import { DATABASE_UNAVAILABLE_ERROR_CODES, DatabaseUnavailableException } from './prisma.exceptions';

export type PrismaTransaction = Prisma.TransactionClient;
export type PrismaClientContext = PrismaClient | PrismaTransaction;

export abstract class PrismaRepository {
  protected constructor(protected readonly prisma: PrismaClient) {}

  transaction<T>(operation: (transaction: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation);
  }

  protected client(transaction?: PrismaTransaction): PrismaClientContext {
    return transaction ?? this.prisma;
  }

  protected async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (this.isDatabaseUnavailableError(error)) {
        throw new DatabaseUnavailableException(error);
      }

      throw error;
    }
  }

  private isDatabaseUnavailableError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return true;
    }

    let current: unknown = error;

    while (typeof current === 'object' && current !== null) {
      if ('code' in current && DATABASE_UNAVAILABLE_ERROR_CODES.has(String(current.code))) {
        return true;
      }

      current = 'cause' in current ? current.cause : undefined;
    }

    return false;
  }
}
