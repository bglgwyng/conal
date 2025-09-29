import type { Dynamic } from "./Dynamic";

export function pullCurrent<T>(
	fn: () => Generator<Dynamic<unknown>, T>,
): [T, Set<Dynamic<unknown>>] {
	const deps = [];
	const it = fn();
	let value: unknown;

	while (true) {
		const result = it.next(value);
		if (result.done) {
			return [result.value, new Set(deps)];
		} else {
			value = result.value.readCurrent();
			deps.push(result.value);
		}
	}
}

export function pullCurrentWithoutTracking<T>(
	fn: () => Generator<Dynamic<unknown>, T>,
): T {
	const it = fn();
	let value: unknown;

	while (true) {
		const result = it.next(value);
		if (result.done) {
			return result.value;
		} else {
			value = result.value.readCurrent();
		}
	}
}

export function pullNext<T>(
	fn: () => Generator<Dynamic<unknown>, T>,
): [T, Set<Dynamic<unknown>>] {
	const deps = [];
	const it = fn();
	let value: unknown;

	while (true) {
		const result = it.next(value);
		if (result.done) {
			return [result.value, new Set(deps)];
		} else {
			value = result.value.readNext().value;
			deps.push(result.value);
		}
	}
}
