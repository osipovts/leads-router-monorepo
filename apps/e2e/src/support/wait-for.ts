const WAIT_INTERVAL_MS = 100;

function isMet<T>(value: T): boolean {
  return value !== null && value !== undefined && value !== false;
}

/**
 * Периодически опрашивает `probe`, пока не вернётся truthy-значение, и возвращает его.
 * Бросает ошибку по истечении `timeoutMs` - это стандартный приём для ожидания
 * асинхронных эффектов (обработка BullMQ job, запись в БД и т.п.).
 */
export async function waitFor<T>(probe: () => Promise<T> | T, timeoutMs = 10_000, label = 'condition'): Promise<T> {
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
