import { beforeEach, describe, expect, it, vi } from "vitest";
import { DerivedBehavior } from "../../src/core/behavior/DerivedBehavior";
import { Timeline } from "../../src/Timeline";

describe("DerivedBehavior - Memoization", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
		timeline.unsafeActivate();
	});

	it("should memoize computed values within the same timestamp", () => {
		const source = timeline.source<number>();
		const state = timeline.state(0, source);
		const computeFn = vi.fn().mockImplementation(() => {
			return state.read() * 2;
		});

		const derived = new DerivedBehavior(timeline, computeFn);

		timeline.unsafeStart();

		// First read - should compute the value
		expect(derived.read()).toBe(0);
		expect(computeFn).toHaveBeenCalledTimes(1);

		// Second read within same timestamp - should use cached value
		expect(derived.read()).toBe(0);
		expect(computeFn).toHaveBeenCalledTimes(1);

		// Change timestamp and read again - should recompute
		timeline.flush();
		expect(derived.read()).toBe(0);
		expect(computeFn).toHaveBeenCalledTimes(2);

		// // Update state and verify recomputation
		source.emit(5);
		timeline.flush();

		expect(derived.read()).toBe(10);
		expect(computeFn).toHaveBeenCalledTimes(3);
	});
});
