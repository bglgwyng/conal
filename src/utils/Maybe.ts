export type Maybe<T> = (() => T) | undefined;

export function just<T>(value: T): Maybe<T> {
	return () => value;
}
