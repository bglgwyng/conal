import { beforeEach, describe, expect, it, vitest } from "vitest";
import { MergedEvent } from "../../../src/core/event/MergedEvent";
import { Source } from "../../../src/core/event/Source";
import { Timeline } from "../../../src/Timeline";

describe("MergedEvent", () => {
	let timeline: Timeline;
	let leftSource: Source<string>;
	let rightSource: Source<number>;
	let mergedEvent: MergedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
		leftSource = new Source<string>(timeline);
		rightSource = new Source<number>(timeline);
	});

	it("should merge left and right events into a 'both' type when both emit values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		// Emit left value first
		leftSource.emit("hello");
		rightSource.emit(42);
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "both",
			left: "hello",
			right: 42,
		});
	});

	it("should handle left-only values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		// Emit only left value
		leftSource.emit("left only");
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "left",
			value: "left only",
		});
	});

	it("should handle right-only values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		// Emit only right value
		rightSource.emit(100);
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "right",
			value: 100,
		});
	});

	it("should update values when sources emit multiple times", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		leftSource.emit("first");
		rightSource.emit(1);
		timeline.proceed();

		expect(mockCallback).toHaveBeenLastCalledWith({
			type: "both",
			left: "first",
			right: 1,
		});
	});

	it("should handle interleaved emissions correctly", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const results: any[] = [];
		mergedEvent.on((value) => results.push(value));

		// Emit in interleaved order
		leftSource.emit("a");
		timeline.proceed();

		rightSource.emit(1);
		timeline.proceed();

		leftSource.emit("b");
		timeline.proceed();

		leftSource.emit("c");
		rightSource.emit(2);
		timeline.proceed();

		expect(results).toEqual([
			{ type: "left", value: "a" },
			{ type: "right", value: 1 },
			{ type: "left", value: "b" },
			{ type: "both", left: "c", right: 2 },
		]);
	});

	describe("caching dynamic", () => {
		it("should cache emitted value and not recompute on multiple getEmission calls", () => {
			// Mock the child events' getEmission to track calls
			const leftgetEmission = vitest.spyOn(leftSource, "getEmission");
			const rightgetEmission = vitest.spyOn(rightSource, "getEmission");

			mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

			leftSource.emit("test");
			rightSource.emit(42);

			// First call should compute the value
			const firstResult = mergedEvent.getEmission();
			const firstCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(firstResult?.()).toEqual({
				type: "both",
				left: "test",
				right: 42,
			});

			// Second call should use cached value, not recompute
			const secondResult = mergedEvent.getEmission();
			const secondCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(secondResult?.()).toEqual({
				type: "both",
				left: "test",
				right: 42,
			});

			// Should not have made additional calls to child events
			expect(secondCallCount).toBe(firstCallCount);
			// Both results should be the same reference
			expect(firstResult).toBe(secondResult);

			leftgetEmission.mockRestore();
			rightgetEmission.mockRestore();
		});

		it("should clear cache after commit and recompute on next getEmission", () => {
			const leftgetEmission = vitest.spyOn(leftSource, "getEmission");
			const rightgetEmission = vitest.spyOn(rightSource, "getEmission");

			mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

			leftSource.emit("first");
			rightSource.emit(1);

			// First computation
			const firstResult = mergedEvent.getEmission();
			const firstCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
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
			const secondResult = mergedEvent.getEmission();
			const secondCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(secondResult?.()).toEqual({
				type: "both",
				left: "second",
				right: 2,
			});

			// Should have made additional calls after commit
			expect(secondCallCount).toBeGreaterThan(firstCallCount);

			leftgetEmission.mockRestore();
			rightgetEmission.mockRestore();
		});

		it("should clear maybeEmittedValue in commit method", () => {
			mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

			leftSource.emit("cached");
			rightSource.emit(100);

			// First call caches the value
			const firstResult = mergedEvent.getEmission();
			expect(firstResult?.()).toEqual({
				type: "both",
				left: "cached",
				right: 100,
			});

			// Verify cache exists by calling again (should return same reference)
			const cachedResult = mergedEvent.getEmission();
			expect(cachedResult).toBe(firstResult); // Same reference

			// Call commit - this should clear maybeEmittedValue
			mergedEvent.commit();

			// Now getEmission should recompute even with same parent values
			// because maybeEmittedValue was cleared
			const afterCommitResult = mergedEvent.getEmission();
			expect(afterCommitResult?.()).toEqual({
				type: "both",
				left: "cached",
				right: 100,
			}); // Same value
			expect(afterCommitResult).not.toBe(firstResult); // Different reference
		});

		it("should not cache when no child events have emitted values", () => {
			const leftgetEmission = vitest.spyOn(leftSource, "getEmission");
			const rightgetEmission = vitest.spyOn(rightSource, "getEmission");

			mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

			// Don't emit anything to either source

			// Should return undefined and not cache
			const result = mergedEvent.getEmission();
			expect(result).toBeUndefined();

			// Multiple calls should still not cache anything
			const result2 = mergedEvent.getEmission();
			expect(result2).toBeUndefined();

			leftgetEmission.mockRestore();
			rightgetEmission.mockRestore();
		});

		it("should cache left-only values correctly", () => {
			const leftgetEmission = vitest.spyOn(leftSource, "getEmission");
			const rightgetEmission = vitest.spyOn(rightSource, "getEmission");

			mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

			leftSource.emit("left-only");
			// Don't emit to right source

			// First call should compute and cache
			const firstResult = mergedEvent.getEmission();
			const firstCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(firstResult?.()).toEqual({ type: "left", value: "left-only" });

			// Second call should use cache
			const secondResult = mergedEvent.getEmission();
			const secondCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(secondResult?.()).toEqual({ type: "left", value: "left-only" });

			// Should not have made additional calls
			expect(secondCallCount).toBe(firstCallCount);
			expect(firstResult).toBe(secondResult);

			leftgetEmission.mockRestore();
			rightgetEmission.mockRestore();
		});

		it("should cache right-only values correctly", () => {
			const leftgetEmission = vitest.spyOn(leftSource, "getEmission");
			const rightgetEmission = vitest.spyOn(rightSource, "getEmission");

			mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

			// Don't emit to left source
			rightSource.emit(999);

			// First call should compute and cache
			const firstResult = mergedEvent.getEmission();
			const firstCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(firstResult?.()).toEqual({ type: "right", value: 999 });

			// Second call should use cache
			const secondResult = mergedEvent.getEmission();
			const secondCallCount =
				leftgetEmission.mock.calls.length + rightgetEmission.mock.calls.length;
			expect(secondResult?.()).toEqual({ type: "right", value: 999 });

			// Should not have made additional calls
			expect(secondCallCount).toBe(firstCallCount);
			expect(firstResult).toBe(secondResult);

			leftgetEmission.mockRestore();
			rightgetEmission.mockRestore();
		});

		it("should cache independently for nested MergedEvents", () => {
			const thirdSource = new Source<boolean>(timeline);
			const innerMerged = new MergedEvent(timeline, leftSource, rightSource);
			const outerMerged = new MergedEvent(timeline, innerMerged, thirdSource);

			const leftgetEmission = vitest.spyOn(leftSource, "getEmission");
			const rightgetEmission = vitest.spyOn(rightSource, "getEmission");
			const thirdgetEmission = vitest.spyOn(thirdSource, "getEmission");
			const innergetEmission = vitest.spyOn(innerMerged, "getEmission");

			leftSource.emit("nested");
			rightSource.emit(42);
			thirdSource.emit(true);

			// First call computes both levels
			const result1 = outerMerged.getEmission();
			const firstCallCount =
				leftgetEmission.mock.calls.length +
				rightgetEmission.mock.calls.length +
				thirdgetEmission.mock.calls.length +
				innergetEmission.mock.calls.length;
			expect(result1?.()).toEqual({
				type: "both",
				left: { type: "both", left: "nested", right: 42 },
				right: true,
			});

			// Second call should use both caches
			const result2 = outerMerged.getEmission();
			const secondCallCount =
				leftgetEmission.mock.calls.length +
				rightgetEmission.mock.calls.length +
				thirdgetEmission.mock.calls.length +
				innergetEmission.mock.calls.length;
			expect(result2?.()).toEqual({
				type: "both",
				left: { type: "both", left: "nested", right: 42 },
				right: true,
			});

			// Should not have made additional calls (both levels cached)
			expect(secondCallCount).toBe(firstCallCount);
			expect(result1).toBe(result2);

			// Accessing intermediate result should also be cached
			const intermediate1 = innerMerged.getEmission();
			const intermediate2 = innerMerged.getEmission();
			expect(intermediate1?.()).toEqual({
				type: "both",
				left: "nested",
				right: 42,
			});
			expect(intermediate1).toBe(intermediate2);

			leftgetEmission.mockRestore();
			rightgetEmission.mockRestore();
			thirdgetEmission.mockRestore();
			innergetEmission.mockRestore();
		});
	});
});
