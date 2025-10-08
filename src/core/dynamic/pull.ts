import { type WaitEffect, wait } from "../Node";
import type { Dynamic } from "./Dynamic";

export type Pull<T> = () => Generator<Dynamic<unknown>, T>;

export function pullCurrent<T>(fn: Pull<T>): [T, Dynamic<unknown>[]] {
	const depsSet = new Set<Dynamic<unknown>>();
	const deps = [];
	const it = fn();
	let value: unknown;

	while (true) {
		const result = it.next(value);
		if (result.done) {
			return [result.value, deps];
		} else {
			value = result.value.readCurrent();

			if (!depsSet.has(result.value)) {
				depsSet.add(result.value);
				deps.push(result.value);
			}
		}
	}
}

export function pullCurrentWithoutTracking<T>(fn: Pull<T>): T {
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

export function* pullNext<T>(
	fn: Pull<T>,
): Generator<WaitEffect, [T, Dynamic<unknown>[]]> {
	const depsSet = new Set<Dynamic<unknown>>();
	const deps = [];
	const it = fn();
	let value: unknown;

	while (true) {
		const result = it.next(value);
		if (result.done) {
			return [result.value, deps];
		} else {
			yield* wait(result.value);
			value = result.value.readNext().value;

			if (!depsSet.has(result.value)) {
				depsSet.add(result.value);
				deps.push(result.value);
			}
		}
	}
}
