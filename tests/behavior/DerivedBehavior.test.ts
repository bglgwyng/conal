import { beforeEach, describe, expect, it } from "vitest";
import { DerivedBehavior } from "../../src/behavior/DerivedBehavior";
import { Timeline } from "../../src/Timeline";

describe("DerivedBehavior", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	it("should compute derived value from state", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a derived behavior that doubles the state value
		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		expect(derived.read()).toBe(0);

		// Set initial state value
		source1.emit(5); // This will update both state1 and state2
		source2.emit(10);
		timeline.flush();

		// Check if derived value is computed correctly
		expect(derived.read()).toBe(15);
	});

	it("should track dependencies", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a derived behavior that depends on two states
		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		expect(derived.dependencies).toBeUndefined();

		// Initial read should track dependencies
		const result = derived.read();
		expect(result).toBe(0);

		// Check if dependencies are tracked
		expect(derived.dependencies?.size).toBe(2);
		expect(derived.dependencies?.has(state1)).toBe(true);
		expect(derived.dependencies?.has(state2)).toBe(true);
	});
});
