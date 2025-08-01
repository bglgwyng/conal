import { beforeEach, describe, expect, it, vitest } from "vitest";
import type { MergedEvent } from "../../src/event/MergedEvent";
import { Source } from "../../src/event/Source";
import { merge, source } from "../../src/factory";
import { Timeline } from "../../src/Timeline";

describe("MergedEvent", () => {
	let timeline: Timeline;
	let leftSource: Source<string>;
	let rightSource: Source<number>;
	let mergedEvent: MergedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline();
		timeline.unsafeActivate();

		leftSource = source<string>();
		rightSource = source<number>();
	});

	it("should merge left and right events into a 'both' type when both emit values", () => {
		mergedEvent = merge(leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.unsafeStart();

		// Emit left value first
		leftSource.emit("hello");
		rightSource.emit(42);
		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "both",
			left: "hello",
			right: 42,
		});
	});

	it("should handle left-only values", () => {
		mergedEvent = merge(leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.unsafeStart();

		// Emit only left value
		leftSource.emit("left only");
		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "left",
			value: "left only",
		});
	});

	it("should handle right-only values", () => {
		mergedEvent = merge(leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.unsafeStart();

		// Emit only right value
		rightSource.emit(100);
		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "right",
			value: 100,
		});
	});

	it("should update values when sources emit multiple times", () => {
		mergedEvent = merge(leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.unsafeStart();

		leftSource.emit("first");
		rightSource.emit(1);
		timeline.flush();

		expect(mockCallback).toHaveBeenLastCalledWith({
			type: "both",
			left: "first",
			right: 1,
		});
	});

	it("should handle interleaved emissions correctly", () => {
		mergedEvent = merge(leftSource, rightSource);

		const results: any[] = [];
		mergedEvent.on((value) => results.push(value));

		timeline.unsafeStart();

		// Emit in interleaved order
		leftSource.emit("a");
		timeline.flush();

		rightSource.emit(1);
		timeline.flush();

		leftSource.emit("b");
		timeline.flush();

		leftSource.emit("c");
		rightSource.emit(2);
		timeline.flush();

		expect(results).toEqual([
			{ type: "left", value: "a" },
			{ type: "right", value: 1 },
			{ type: "left", value: "b" },
			{ type: "both", left: "c", right: 2 },
		]);
	});

	describe("caching behavior", () => {
		it("should cache emitted value and not recompute on multiple getEmittedValue calls", () => {
			// Mock the child events' getEmittedValue to track calls
			const leftGetEmittedValue = vitest.spyOn(leftSource, "getEmittedValue");
			const rightGetEmittedValue = vitest.spyOn(rightSource, "getEmittedValue");

			mergedEvent = merge(leftSource, rightSource);

			timeline.unsafeStart();
			leftSource.emit("test");
			rightSource.emit(42);

			// First call should compute the value
			const firstResult = mergedEvent.getEmittedValue();
			const firstCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(firstResult?.()).toEqual({
				type: "both",
				left: "test",
				right: 42,
			});

			// Second call should use cached value, not recompute
			const secondResult = mergedEvent.getEmittedValue();
			const secondCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(secondResult?.()).toEqual({
				type: "both",
				left: "test",
				right: 42,
			});

			// Should not have made additional calls to child events
			expect(secondCallCount).toBe(firstCallCount);
			// Both results should be the same reference
			expect(firstResult).toBe(secondResult);

			leftGetEmittedValue.mockRestore();
			rightGetEmittedValue.mockRestore();
		});

		it("should clear cache after commit and recompute on next getEmittedValue", () => {
			const leftGetEmittedValue = vitest.spyOn(leftSource, "getEmittedValue");
			const rightGetEmittedValue = vitest.spyOn(rightSource, "getEmittedValue");

			mergedEvent = merge(leftSource, rightSource);

			timeline.unsafeStart();
			leftSource.emit("first");
			rightSource.emit(1);

			// First computation
			const firstResult = mergedEvent.getEmittedValue();
			const firstCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(firstResult?.()).toEqual({
				type: "both",
				left: "first",
				right: 1,
			});

			// Commit clears the cache
			mergedEvent.commit();

			// Emit new values
			leftSource.emit("second");
			rightSource.emit(2);

			// Should recompute since cache was cleared
			const secondResult = mergedEvent.getEmittedValue();
			const secondCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(secondResult?.()).toEqual({
				type: "both",
				left: "second",
				right: 2,
			});

			// Should have made additional calls after commit
			expect(secondCallCount).toBeGreaterThan(firstCallCount);

			leftGetEmittedValue.mockRestore();
			rightGetEmittedValue.mockRestore();
		});

		it("should clear maybeEmittedValue in commit method", () => {
			mergedEvent = merge(leftSource, rightSource);

			timeline.unsafeStart();
			leftSource.emit("cached");
			rightSource.emit(100);

			// First call caches the value
			const firstResult = mergedEvent.getEmittedValue();
			expect(firstResult?.()).toEqual({
				type: "both",
				left: "cached",
				right: 100,
			});

			// Verify cache exists by calling again (should return same reference)
			const cachedResult = mergedEvent.getEmittedValue();
			expect(cachedResult).toBe(firstResult); // Same reference

			// Call commit - this should clear maybeEmittedValue
			mergedEvent.commit();

			// Now getEmittedValue should recompute even with same parent values
			// because maybeEmittedValue was cleared
			const afterCommitResult = mergedEvent.getEmittedValue();
			expect(afterCommitResult?.()).toEqual({
				type: "both",
				left: "cached",
				right: 100,
			}); // Same value
			expect(afterCommitResult).not.toBe(firstResult); // Different reference
		});

		it("should not cache when no child events have emitted values", () => {
			const leftGetEmittedValue = vitest.spyOn(leftSource, "getEmittedValue");
			const rightGetEmittedValue = vitest.spyOn(rightSource, "getEmittedValue");

			mergedEvent = merge(leftSource, rightSource);

			timeline.unsafeStart();
			// Don't emit anything to either source

			// Should return undefined and not cache
			const result = mergedEvent.getEmittedValue();
			expect(result).toBeUndefined();

			// Multiple calls should still not cache anything
			const result2 = mergedEvent.getEmittedValue();
			expect(result2).toBeUndefined();

			leftGetEmittedValue.mockRestore();
			rightGetEmittedValue.mockRestore();
		});

		it("should cache left-only values correctly", () => {
			const leftGetEmittedValue = vitest.spyOn(leftSource, "getEmittedValue");
			const rightGetEmittedValue = vitest.spyOn(rightSource, "getEmittedValue");

			mergedEvent = merge(leftSource, rightSource);

			timeline.unsafeStart();
			leftSource.emit("left-only");
			// Don't emit to right source

			// First call should compute and cache
			const firstResult = mergedEvent.getEmittedValue();
			const firstCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(firstResult?.()).toEqual({ type: "left", value: "left-only" });

			// Second call should use cache
			const secondResult = mergedEvent.getEmittedValue();
			const secondCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(secondResult?.()).toEqual({ type: "left", value: "left-only" });

			// Should not have made additional calls
			expect(secondCallCount).toBe(firstCallCount);
			expect(firstResult).toBe(secondResult);

			leftGetEmittedValue.mockRestore();
			rightGetEmittedValue.mockRestore();
		});

		it("should cache right-only values correctly", () => {
			const leftGetEmittedValue = vitest.spyOn(leftSource, "getEmittedValue");
			const rightGetEmittedValue = vitest.spyOn(rightSource, "getEmittedValue");

			mergedEvent = merge(leftSource, rightSource);

			timeline.unsafeStart();
			// Don't emit to left source
			rightSource.emit(999);

			// First call should compute and cache
			const firstResult = mergedEvent.getEmittedValue();
			const firstCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(firstResult?.()).toEqual({ type: "right", value: 999 });

			// Second call should use cache
			const secondResult = mergedEvent.getEmittedValue();
			const secondCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length;
			expect(secondResult?.()).toEqual({ type: "right", value: 999 });

			// Should not have made additional calls
			expect(secondCallCount).toBe(firstCallCount);
			expect(firstResult).toBe(secondResult);

			leftGetEmittedValue.mockRestore();
			rightGetEmittedValue.mockRestore();
		});

		it("should cache independently for nested MergedEvents", () => {
			const thirdSource = new Source<boolean>(timeline);
			const innerMerged = merge(leftSource, rightSource);
			const outerMerged = merge(innerMerged, thirdSource);

			const leftGetEmittedValue = vitest.spyOn(leftSource, "getEmittedValue");
			const rightGetEmittedValue = vitest.spyOn(rightSource, "getEmittedValue");
			const thirdGetEmittedValue = vitest.spyOn(thirdSource, "getEmittedValue");
			const innerGetEmittedValue = vitest.spyOn(innerMerged, "getEmittedValue");

			timeline.unsafeStart();
			leftSource.emit("nested");
			rightSource.emit(42);
			thirdSource.emit(true);

			// First call computes both levels
			const result1 = outerMerged.getEmittedValue();
			const firstCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length +
				thirdGetEmittedValue.mock.calls.length +
				innerGetEmittedValue.mock.calls.length;
			expect(result1?.()).toEqual({
				type: "both",
				left: { type: "both", left: "nested", right: 42 },
				right: true,
			});

			// Second call should use both caches
			const result2 = outerMerged.getEmittedValue();
			const secondCallCount =
				leftGetEmittedValue.mock.calls.length +
				rightGetEmittedValue.mock.calls.length +
				thirdGetEmittedValue.mock.calls.length +
				innerGetEmittedValue.mock.calls.length;
			expect(result2?.()).toEqual({
				type: "both",
				left: { type: "both", left: "nested", right: 42 },
				right: true,
			});

			// Should not have made additional calls (both levels cached)
			expect(secondCallCount).toBe(firstCallCount);
			expect(result1).toBe(result2);

			// Accessing intermediate result should also be cached
			const intermediate1 = innerMerged.getEmittedValue();
			const intermediate2 = innerMerged.getEmittedValue();
			expect(intermediate1?.()).toEqual({
				type: "both",
				left: "nested",
				right: 42,
			});
			expect(intermediate1).toBe(intermediate2);

			leftGetEmittedValue.mockRestore();
			rightGetEmittedValue.mockRestore();
			thirdGetEmittedValue.mockRestore();
			innerGetEmittedValue.mockRestore();
		});
	});
});
