import { beforeEach, describe, expect, it, vitest } from "vitest";
import { DerivedEvent, Discard } from "../../../src/core/event/DerivedEvent";
import { Source } from "../../../src/core/event/Source";
import { Timeline } from "../../../src/Timeline";

describe("DerivedEvent", () => {
	let timeline: Timeline;
	let parentEvent: Source<number>;
	let derivedEvent: DerivedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline();
		parentEvent = new Source<number>(timeline);
	});

	it("should transform parent event values using the provided function", () => {
		const transformFn = (n: number) => `Number: ${n}`;
		derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		derivedEvent.on(mockCallback);

		parentEvent.emit(42);

		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42");
	});

	it("should transform parent event values using the provided function", () => {
		const transformFn = (n: number) => `Number: ${n}`;
		derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		derivedEvent.on(mockCallback);

		parentEvent.emit(42);

		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42");
	});

	it("should chain multiple DerivedEvents correctly", () => {
		const transformFn1 = (n: number) => `Number: ${n}`;
		const derived1 = new DerivedEvent(timeline, parentEvent, transformFn1);

		const transformFn2 = (s: string) => `${s}!`;
		const derived2 = new DerivedEvent(timeline, derived1, transformFn2);

		const mockCallback = vitest.fn();
		derived2.on(mockCallback);

		parentEvent.emit(42);
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42!");
	});

	it("should not propagate when Discard is thrown", async () => {
		const transformFn = (n: number) => {
			if (n % 2 === 0) throw Discard;
			return `Number: ${n}`;
		};

		derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		derivedEvent.on(mockCallback);

		// This should be discarded (even number)
		parentEvent.emit(42);
		timeline.proceed();
		expect(mockCallback).not.toHaveBeenCalled();

		// This should propagate (odd number)
		parentEvent.emit(7);
		timeline.proceed();
		expect(mockCallback).toHaveBeenCalledWith("Number: 7");
	});

	describe("caching behavior", () => {
		it("should cache emitted value and not recompute on multiple getEmittedValue calls", () => {
			const transformFn = vitest.fn((n: number) => `Number: ${n}`);
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			parentEvent.emit(42);

			// First call should compute the value
			const firstResult = derivedEvent.getEmittedValue();
			expect(transformFn).toHaveBeenCalledTimes(1);
			expect(firstResult?.()).toBe("Number: 42");

			// Second call should use cached value, not recompute
			const secondResult = derivedEvent.getEmittedValue();
			expect(transformFn).toHaveBeenCalledTimes(1); // Still only called once
			expect(secondResult?.()).toBe("Number: 42");

			// Both results should be the same function reference
			expect(firstResult).toBe(secondResult);
		});

		it("should clear cache after commit and recompute on next getEmittedValue", () => {
			const transformFn = vitest.fn((n: number) => `Number: ${n}`);
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			parentEvent.emit(42);

			// First computation
			const firstResult = derivedEvent.getEmittedValue();
			expect(transformFn).toHaveBeenCalledTimes(1);
			expect(firstResult?.()).toBe("Number: 42");

			// Commit clears the cache
			derivedEvent.commit();

			// Emit new value
			parentEvent.emit(100);

			// Should recompute since cache was cleared
			const secondResult = derivedEvent.getEmittedValue();
			expect(transformFn).toHaveBeenCalledTimes(2); // Called twice now
			expect(secondResult?.()).toBe("Number: 100");
		});

		it("should clear maybeEmittedValue in commit method", () => {
			const transformFn = vitest.fn((n: number) => `Number: ${n}`);
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			parentEvent.emit(42);

			// First call caches the value
			const firstResult = derivedEvent.getEmittedValue();
			expect(firstResult?.()).toBe("Number: 42");
			expect(transformFn).toHaveBeenCalledTimes(1);

			// Verify cache exists by calling again (should not recompute)
			const cachedResult = derivedEvent.getEmittedValue();
			expect(cachedResult).toBe(firstResult); // Same reference
			expect(transformFn).toHaveBeenCalledTimes(1); // Still only 1 call

			// Call commit - this should clear maybeEmittedValue
			derivedEvent.commit();

			// Now getEmittedValue should recompute even with same parent value
			// because maybeEmittedValue was cleared
			const afterCommitResult = derivedEvent.getEmittedValue();
			expect(afterCommitResult?.()).toBe("Number: 42"); // Same value
			expect(afterCommitResult).not.toBe(firstResult); // Different reference
			expect(transformFn).toHaveBeenCalledTimes(2); // Recomputed
		});

		it("should not cache when parent has no emitted value", () => {
			const transformFn = vitest.fn((n: number) => `Number: ${n}`);
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			// Don't emit anything to parent

			// Should return undefined and not call transform function
			const result = derivedEvent.getEmittedValue();
			expect(result).toBeUndefined();
			expect(transformFn).not.toHaveBeenCalled();

			// Multiple calls should still not cache anything
			const result2 = derivedEvent.getEmittedValue();
			expect(result2).toBeUndefined();
			expect(transformFn).not.toHaveBeenCalled();
		});

		it("should not cache when transformation throws Discard", () => {
			const transformFn = vitest.fn((n: number) => {
				if (n % 2 === 0) throw Discard;
				return `Number: ${n}`;
			});
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			parentEvent.emit(42); // Even number, should be discarded

			// Should return undefined and not cache
			const result = derivedEvent.getEmittedValue();
			expect(result).toBeUndefined();
			expect(transformFn).toHaveBeenCalledTimes(1);

			// Second call should call transform function again (no caching)
			const result2 = derivedEvent.getEmittedValue();
			expect(result2).toBeUndefined();
			expect(transformFn).toHaveBeenCalledTimes(2);
		});

		it("should cache successful computation after Discard", () => {
			const transformFn = vitest.fn((n: number) => {
				if (n % 2 === 0) throw Discard;
				return `Number: ${n}`;
			});
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			// First emit even number (discarded)
			parentEvent.emit(42);
			const discardedResult = derivedEvent.getEmittedValue();
			expect(discardedResult).toBeUndefined();
			expect(transformFn).toHaveBeenCalledTimes(1);

			// Then emit odd number (should be cached)
			parentEvent.emit(7);
			const successResult1 = derivedEvent.getEmittedValue();
			expect(successResult1?.()).toBe("Number: 7");
			expect(transformFn).toHaveBeenCalledTimes(2);

			// Second call should use cache
			const successResult2 = derivedEvent.getEmittedValue();
			expect(successResult2?.()).toBe("Number: 7");
			expect(transformFn).toHaveBeenCalledTimes(2); // Still only 2 calls
			expect(successResult1).toBe(successResult2);
		});

		it("should handle errors in transformation without caching", () => {
			const transformFn = vitest.fn((n: number) => {
				if (n === 42) throw new Error("Test error");
				return `Number: ${n}`;
			});
			derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

			parentEvent.emit(42);

			// Should throw error and not cache
			expect(() => derivedEvent.getEmittedValue()).toThrow("Test error");
			expect(transformFn).toHaveBeenCalledTimes(1);

			// Second call should throw again (no caching of errors)
			expect(() => derivedEvent.getEmittedValue()).toThrow("Test error");
			expect(transformFn).toHaveBeenCalledTimes(2);
		});

		it("should cache independently for chained DerivedEvents", () => {
			const transformFn1 = vitest.fn((n: number) => `Number: ${n}`);
			const transformFn2 = vitest.fn((s: string) => `${s}!`);

			const derived1 = new DerivedEvent(timeline, parentEvent, transformFn1);
			const derived2 = new DerivedEvent(timeline, derived1, transformFn2);

			parentEvent.emit(42);

			// First call computes both levels
			const result1 = derived2.getEmittedValue();
			expect(result1?.()).toBe("Number: 42!");
			expect(transformFn1).toHaveBeenCalledTimes(1);
			expect(transformFn2).toHaveBeenCalledTimes(1);

			// Second call should use both caches
			const result2 = derived2.getEmittedValue();
			expect(result2?.()).toBe("Number: 42!");
			expect(transformFn1).toHaveBeenCalledTimes(1); // Still cached
			expect(transformFn2).toHaveBeenCalledTimes(1); // Still cached
			expect(result1).toBe(result2);

			// Accessing intermediate result should also be cached
			const intermediate1 = derived1.getEmittedValue();
			const intermediate2 = derived1.getEmittedValue();
			expect(intermediate1?.()).toBe("Number: 42");
			expect(intermediate1).toBe(intermediate2);
			expect(transformFn1).toHaveBeenCalledTimes(1); // Still cached
		});
	});
});
