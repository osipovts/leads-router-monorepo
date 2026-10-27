import type { PrismaClient } from './generated/client';
import { DatabaseUnavailableException } from './prisma.exceptions';
import { PrismaRepository } from './prisma.repository';

// execute защищён в абстракции: подкласс открывает его тесту
class TestRepository extends PrismaRepository {
  constructor() {
    super({} as PrismaClient);
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.execute(operation);
  }
}

describe('PrismaRepository.execute', (): void => {
  let repository: TestRepository;

  beforeEach((): void => {
    repository = new TestRepository();
  });

  it('passes a successful operation through', async (): Promise<void> => {
    await expect(repository.run((): Promise<string> => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('maps an unavailability code to the unavailability exception', async (): Promise<void> => {
    const failure = Object.assign(new Error('connect failed'), { code: 'P1001' });

    await expect(repository.run((): Promise<never> => Promise.reject(failure))).rejects.toBeInstanceOf(
      DatabaseUnavailableException,
    );
  });

  it('detects an unavailability code through a cause chain', async (): Promise<void> => {
    const failure = new Error('adapter failed', {
      cause: Object.assign(new Error('socket'), { code: 'ECONNREFUSED' }),
    });

    await expect(repository.run((): Promise<never> => Promise.reject(failure))).rejects.toBeInstanceOf(
      DatabaseUnavailableException,
    );
  });

  it('rethrows unrelated errors as is', async (): Promise<void> => {
    const failure = new Error('unique constraint violated');

    await expect(repository.run((): Promise<never> => Promise.reject(failure))).rejects.toBe(failure);
  });

  it('terminates on a cyclic cause chain instead of hanging', async (): Promise<void> => {
    const cyclic = new Error('cyclic cause');
    cyclic.cause = cyclic;

    await expect(repository.run((): Promise<never> => Promise.reject(cyclic))).rejects.toBe(cyclic);
  });
});
