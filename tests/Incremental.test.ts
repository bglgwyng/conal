import { beforeEach, describe, expect, it, vi } from "vitest";
import { proceedImmediately } from "../src";
import { Dynamic } from "../src/Dynamic";
import type { Event } from "../src/Event";
import { Incremental } from "../src/Incremental";
import { Timeline } from "../src/Timeline";

describe("Incremental", () => {
	let t: Timeline;

	beforeEach(() => {
		t = new Timeline({ onSourceEmission: proceedImmediately });
	});

	describe("constructor", () => {
		it("should create an Incremental instance that extends Dynamic", () => {
			const [transitionEvent, _emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(0, transitionEvent);

			expect(incremental).toBeInstanceOf(Incremental);
			expect(incremental).toBeInstanceOf(Dynamic);
			expect(incremental.internal).toBeDefined();
		});

		it("should initialize with the provided initial value", () => {
			const [transitionEvent, _emit] = t.source<readonly [number, number]>();
			const initialValue = 42;
			const incremental = t.incremental(initialValue, transitionEvent);

			expect(incremental.read()).toBe(initialValue);
		});

		it("should store the transition event", () => {
			const [transitionEvent, _emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(10, transitionEvent);

			expect(incremental.transition).toBe(transitionEvent);
		});
	});

	describe("value transitions", () => {
		it("should update value when transition event emits [newValue, delta]", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(10, transitionEvent);

			// Emit transition with [newValue, delta]
			emit([25, 15] as const);

			expect(incremental.read()).toBe(25);
		});

		it("should handle multiple transitions correctly", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(0, transitionEvent);

			// First transition
			emit([10, 10] as const);

			expect(incremental.read()).toBe(10);

			// Second transition
			emit([25, 15] as const);

			expect(incremental.read()).toBe(25);

			// Third transition with negative delta
			emit([20, -5] as const);

			expect(incremental.read()).toBe(20);
		});

		it("should ignore the delta value (D) and only use the new value (T)", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(100, transitionEvent);

			// The delta doesn't matter for the final value
			emit([50, 999] as const); // Large delta, but final value should be 50

			expect(incremental.read()).toBe(50);
		});

		it("should work with negative numbers", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(-10, transitionEvent);

			emit([-25, -15] as const);

			expect(incremental.read()).toBe(-25);
		});
	});

	describe("updated event", () => {
		it("should emit updated event when value changes", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(0, transitionEvent);

			const callback = vi.fn();
			incremental.updated.on(callback);

			emit([42, 42] as const);

			expect(callback).toHaveBeenCalledWith(42);
		});

		it("should emit updated event for each transition", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(0, transitionEvent);

			const callback = vi.fn();
			incremental.updated.on(callback);

			emit([10, 10] as const);

			emit([20, 10] as const);

			emit([15, -5] as const);

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, 10);
			expect(callback).toHaveBeenNthCalledWith(2, 20);
			expect(callback).toHaveBeenNthCalledWith(3, 15);
		});
	});

	describe("integration with other events", () => {
		it("should work with transformed events as transition source", () => {
			const [sourceEvent, emit] = t.source<number>();

			// Transform a simple number event into [T, D] format
			const transitionEvent = sourceEvent.transform(
				(delta: number) => [delta * 2, delta] as const,
			);

			const incremental = t.incremental(0, transitionEvent);

			emit(5); // This becomes [10, 5]

			expect(incremental.read()).toBe(10);
		});

		it("should handle zero values correctly", () => {
			const [transitionEvent, emit] = t.source<readonly [number, number]>();
			const incremental = t.incremental(100, transitionEvent);

			emit([0, -100] as const);

			expect(incremental.read()).toBe(0);
		});

		it("should maintain value when no transitions occur", () => {
			const [transitionEvent, _emit] = t.source<readonly [number, number]>();
			const initialValue = 42;
			const incremental = t.incremental(initialValue, transitionEvent);

			// Proceed timeline without emitting

			expect(incremental.read()).toBe(initialValue);
		});
	});

	describe("integration with UnsafeIncremental", () => {
		it("should work with UnsafeIncremental", () => {
			const [sourceEvent, emit] = t.source<number>();

			const event: Event<readonly [number, number]> = sourceEvent.transform(
				(d) => [accumulator.read() + d, d],
			);

			const accumulator = t.incremental<number, number>(0, event);
			const doubledAccumulator = t.unsafeIncremental(
				() => accumulator.read() * 2,
				event.transform(([v, d]) => [v * 2, d * 2]),
			);
			const twiceDoubledAccumulator = t.computed(function* () {
				return (yield* doubledAccumulator) * 2;
			});

			const doubledAccumulatorTransitionOnSpy = vi.fn();
			doubledAccumulator.transition.on(doubledAccumulatorTransitionOnSpy);

			const twiceDoubledAccumulatorUpdatedOnSpy = vi.fn();
			twiceDoubledAccumulator.updated.on((value) => {
				twiceDoubledAccumulatorUpdatedOnSpy([
					value,
					twiceDoubledAccumulator.read(),
				]);
			});

			emit(5);

			expect(accumulator.read()).toBe(5);
			expect(doubledAccumulator.read()).toBe(10);
			expect(doubledAccumulatorTransitionOnSpy).toHaveBeenLastCalledWith([
				10, 10,
			]);
			expect(twiceDoubledAccumulator.read()).toBe(20);
			expect(twiceDoubledAccumulatorUpdatedOnSpy).toHaveBeenLastCalledWith([
				20, 0,
			]);

			emit(3);

			expect(accumulator.read()).toBe(8);
			expect(doubledAccumulator.read()).toBe(16);
			expect(doubledAccumulatorTransitionOnSpy).toHaveBeenLastCalledWith([
				16, 6,
			]);
			expect(twiceDoubledAccumulator.read()).toBe(32);
			expect(twiceDoubledAccumulatorUpdatedOnSpy).toHaveBeenLastCalledWith([
				32, 20,
			]);
		});
	});
});
