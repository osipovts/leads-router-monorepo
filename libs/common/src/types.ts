export type PlainObject = Record<string, unknown>;
export type Constructor<T, Args extends unknown[] = [T]> = new (...args: Args) => T;
export type TypeOfResult = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'function' | 'object';
