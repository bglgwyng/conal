import { beforeEach, describe, expect, it, vi } from "vitest";
import { DerivedBehavior } from "../../src/behavior/DerivedBehavior";
import { Timeline } from "../../src/Timeline";

describe("DerivedBehavior - updated event", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	it("should trigger updated event when dependencies change", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);

		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Set up a spy to track the updated event
		const updateSpy = vi.fn();
		const unsubscribe = derived.updated.on(updateSpy);

		// Initial read to set up dependencies
		expect(derived.read()).toBe(0);
		expect(updateSpy).not.toHaveBeenCalled();

		// Update first state and flush
		source1.emit(5);
		timeline.flush();

		// Should trigger update with new value (5 + 0)
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenLastCalledWith(5);

		// Update second state and flush
		source2.emit(3);
		timeline.flush();

		// Should trigger update with new value (5 + 3)
		expect(updateSpy).toHaveBeenCalledTimes(2);
		expect(updateSpy).toHaveBeenLastCalledWith(8);

		// // Clean up
		unsubscribe();

		// Update again after unsubscribing
		source1.emit(10);
		timeline.flush();

		// Should not trigger update after unsubscribe
		expect(updateSpy).toHaveBeenCalledTimes(2);
	});
});
