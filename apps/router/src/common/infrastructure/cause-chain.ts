/**
 * Перебирает ошибку и все ошибки, вложенные в неё через поле `cause`.
 *
 * SDK и наш код оборачивают исходную ошибку в свою: `new Error(message, { cause })`.
 * Признак, по которому ошибку классифицируют (код pg вроде `ECONNREFUSED`, SMTP
 * `responseCode`, `TelegramApiError`), часто лежит не в верхней ошибке, а на
 * несколько звеньев глубже. Классификатор перебирает звенья по порядку, начиная
 * с самой ошибки, и останавливается на первом, которое узнаёт:
 *
 * ```ts
 * for (const cause of causeChain(error)) {
 *   if ('code' in cause && cause.code === 'EAUTH') {
 *     return false;
 *   }
 * }
 * ```
 *
 * Обход заканчивается на первом звене, которое не объект: в `cause` может лежать
 * строка или `undefined`, и полей у такого звена нет. Каждое звено отдаётся не
 * больше одного раза: `cause` может ссылаться на уже пройденную ошибку, и без
 * этой проверки цикл в цепочке повесил бы обход навсегда.
 */
export function* causeChain(error: unknown): Generator<object, void, undefined> {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);
    yield current;

    current = 'cause' in current ? current.cause : undefined;
  }
}
