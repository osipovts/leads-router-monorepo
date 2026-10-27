const WAIT_INTERVAL_MS = 100;

type Met<T> = Exclude<T, null | undefined | false>;

function isMet<T>(value: T): value is Met<T> {
  return value !== null && value !== undefined && value !== false;
}

/**
 * Периодически вызывает probe, пока результат отличается от null, undefined и false.
 * Возвращает результат или выбрасывает ошибку по истечении timeoutMs.
 */
export async function waitFor<T>(
  probe: () => Promise<T> | T,
  timeoutMs = 10_000,
  label = 'condition',
): Promise<Met<T>> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await probe();

    if (isMet(result)) {
      return result;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Condition '${label}' was not met within ${timeoutMs.toString()}ms`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, WAIT_INTERVAL_MS);
    });
  }
}
