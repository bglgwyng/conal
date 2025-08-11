import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dynamic } from "../src/Dynamic";
import type { Event } from "../src/Event";
import {
	build,
	computed,
	incremental,
	source,
	transform,
	unsafeIncremental,
} from "../src/factory";
import { Incremental } from "../src/Incremental";
import { Timeline } from "../src/Timeline";
import { UnsafeIncremental } from "../src/UnsafeIncremental";

describe("Incremental", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
		build(timeline);
	});

	describe("constructor", () => {
		it("should create an Incremental instance that extends Dynamic", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 0, transitionEvent);

			expect(incremental).toBeInstanceOf(Incremental);
			expect(incremental).toBeInstanceOf(Dynamic);
			expect(incremental.internal).toBeDefined();
		});

		it("should initialize with the provided initial value", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const initialValue = 42;
			const incremental = new Incremental(
				timeline,
				initialValue,
				transitionEvent,
			);

			expect(incremental.read()).toBe(initialValue);
		});

		it("should store the transition event", () => {
			build(timeline, () => {
				const [transitionEvent, emit] = source<readonly [number, number]>();
				const incremental = new Incremental(timeline, 10, transitionEvent);

				expect(incremental.transition).toBe(transitionEvent);
			});
		});
	});

	describe("value transitions", () => {
		it("should update value when transition event emits [newValue, delta]", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 10, transitionEvent);

			// Emit transition with [newValue, delta]
			emit([25, 15] as const);
			timeline.proceed();

			expect(incremental.read()).toBe(25);
		});

		it("should handle multiple transitions correctly", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 0, transitionEvent);

			// First transition
			emit([10, 10] as const);
			timeline.proceed();
			expect(incremental.read()).toBe(10);

			// Second transition
			emit([25, 15] as const);
			timeline.proceed();
			expect(incremental.read()).toBe(25);

			// Third transition with negative delta
			emit([20, -5] as const);
			timeline.proceed();
			expect(incremental.read()).toBe(20);
		});

		it("should ignore the delta value (D) and only use the new value (T)", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 100, transitionEvent);

			// The delta doesn't matter for the final value
			emit([50, 999] as const); // Large delta, but final value should be 50
			timeline.proceed();

			expect(incremental.read()).toBe(50);
		});

		it("should work with negative numbers", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, -10, transitionEvent);

			emit([-25, -15] as const);
			timeline.proceed();

			expect(incremental.read()).toBe(-25);
		});
	});

	describe("updated event", () => {
		it("should emit updated event when value changes", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 0, transitionEvent);

			const callback = vi.fn();
			incremental.updated.on(callback);

			emit([42, 42] as const);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith(42);
		});

		it("should emit updated event for each transition", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 0, transitionEvent);

			const callback = vi.fn();
			incremental.updated.on(callback);

			emit([10, 10] as const);
			timeline.proceed();

			emit([20, 10] as const);
			timeline.proceed();

			emit([15, -5] as const);
			timeline.proceed();

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, 10);
			expect(callback).toHaveBeenNthCalledWith(2, 20);
			expect(callback).toHaveBeenNthCalledWith(3, 15);
		});
	});

	describe("integration with other events", () => {
		it("should work with transformed events as transition source", () => {
			const [sourceEvent, emit] = source<number>();

			// Transform a simple number event into [T, D] format
			const transitionEvent = transform(
				(delta: number) => [delta * 2, delta] as const,
				sourceEvent,
			);

			const incremental = new Incremental(timeline, 0, transitionEvent);

			emit(5); // This becomes [10, 5]
			timeline.proceed();

			expect(incremental.read()).toBe(10);
		});

		it("should handle zero values correctly", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const incremental = new Incremental(timeline, 100, transitionEvent);

			emit([0, -100] as const);
			timeline.proceed();

			expect(incremental.read()).toBe(0);
		});

		it("should maintain value when no transitions occur", () => {
			const [transitionEvent, emit] = source<readonly [number, number]>();
			const initialValue = 42;
			const incremental = new Incremental(
				timeline,
				initialValue,
				transitionEvent,
			);

			// Proceed timeline without emitting
			timeline.proceed();

			expect(incremental.read()).toBe(initialValue);
		});
	});

	describe("integration with UnsafeIncremental", () => {
		it("should work with UnsafeIncremental", () => {
			const [sourceEvent, emit] = source<number>();

			const event: Event<readonly [number, number]> = transform(
				(d) => [accumulator.read() + d, d],
				sourceEvent,
			);

			const accumulator = incremental<number, number>(0, event);
			const doubledAccumulator = unsafeIncremental(
				() => accumulator.read() * 2,
				event.transform(([v, d]) => [v * 2, d * 2]),
			);
			const twiceDoubledAccumulator = computed(
				() => doubledAccumulator.read() * 2,
			);

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
			timeline.proceed();

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
			timeline.proceed();

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
