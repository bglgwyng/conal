import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComputedBehavior } from "../../../src/core/behavior/ComputedBehavior";
import { Timeline } from "../../../src/Timeline";

describe("ComputedBehavior - Memoization", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
	});

	it("should memoize computed values within the same timestamp", () => {
		const source = timeline.source<number>();
		const state = timeline.state(0, source);
		const computeFn = vi.fn().mockImplementation(() => {
			return state.read() * 2;
		});

		const computed = new ComputedBehavior(timeline, computeFn);

		// First read - should compute the value
		expect(computed.read()).toBe(0);
		expect(computeFn).toHaveBeenCalledTimes(1);

		// Second read within same timestamp - should use cached value
		expect(computed.read()).toBe(0);
		expect(computeFn).toHaveBeenCalledTimes(1);

		// Change timestamp and read again - should recompute
		timeline.proceed();
		expect(computed.read()).toBe(0);
		expect(computeFn).toHaveBeenCalledTimes(2);

		// // Update state and verify recomputation
		source.emit(5);
		timeline.proceed();

		expect(computed.read()).toBe(10);
		expect(computeFn).toHaveBeenCalledTimes(3);
	});

	it("should not call fn again after commit when cache is valid", () => {
		const source = timeline.source<number>();
		const state = timeline.state(1, source);
		const mockFn = vi.fn(() => 42);

		const computed = new ComputedBehavior(timeline, () => {
			const stateValue = state.read();
			return mockFn() + stateValue; // Mock function + state value
		});

		// Activate the computed behavior to enable dependency tracking
		computed.updated.on(() => {});

		// Initial read - fn should be called once
		expect(computed.read()).toBe(43); // 42 + 1
		expect(mockFn).toHaveBeenCalledTimes(1);

		// Update state to trigger recomputation
		source.emit(2);
		timeline.proceed(); // This triggers commit with new cached value

		// After commit, the cache should be updated
		expect(computed.read()).toBe(44); // 42 + 2
		expect(mockFn).toHaveBeenCalledTimes(2);

		// Multiple reads at the same timestamp should use cache - fn should not be called again
		expect(computed.read()).toBe(44);
		expect(computed.read()).toBe(44);
		expect(computed.read()).toBe(44);
		expect(mockFn).toHaveBeenCalledTimes(2); // Still only 2 calls, no additional calls
	});
});
