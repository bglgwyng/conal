import { beforeEach, describe, expect, it } from "vitest";
import { DerivedBehavior } from "../../src/core/behavior/DerivedBehavior";
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

		timeline.start();

		// Set initial state value
		source1.emit(5); // This will update both state1 and state2
		source2.emit(10);
		timeline.flush();

		// Check if derived value is computed correctly
		expect(derived.read()).toBe(15);
	});

	it("should not track dependencies when inactive", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a derived behavior that depends on two states
		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Initially inactive, so no dependencies should be tracked
		expect(derived.isActive).toBe(false);
		expect(derived.dependencies).toBeUndefined();

		// Read when inactive - should not track dependencies
		const result = derived.read();
		expect(result).toBe(0);

		// Should still not track dependencies when inactive
		expect(derived.dependencies).toBeUndefined();
		expect(state1.dependedBehaviors.has(derived)).toBe(false);
		expect(state2.dependedBehaviors.has(derived)).toBe(false);
	});

	it("should track dependencies when active", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a derived behavior that depends on two states
		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Make it active by adding an effect
		const [, unsubscribe] = derived.updated.on(() => {});
		expect(derived.isActive).toBe(true);

		timeline.start();

		// Read when active - should track dependencies
		const result = derived.read();
		expect(result).toBe(0);

		// Should now track dependencies when active
		expect(derived.dependencies?.size).toBe(2);
		expect(derived.dependencies?.has(state1)).toBe(true);
		expect(derived.dependencies?.has(state2)).toBe(true);
		expect(state1.dependedBehaviors.has(derived)).toBe(true);
		expect(state2.dependedBehaviors.has(derived)).toBe(true);

		// Clean up
		unsubscribe();
	});
	it("should track dependencies correctly with nested reads", () => {
		// Create source states
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);

		// Create a derived behavior that will be used inside another derived behavior
		const innerDerived = new DerivedBehavior(
			timeline,
			() => state1.read() * 2, // Double the value of state1
		);
		innerDerived.updated.on(() => {});

		// Create an outer derived behavior that uses the inner derived behavior
		const outerDerived = new DerivedBehavior(
			timeline,
			() => innerDerived.read() + state2.read(), // Use innerDerived + state2
		);
		outerDerived.updated.on(() => {});

		timeline.start();

		// Initial read - should track all dependencies
		expect(outerDerived.read()).toBe(0); // 0*2 + 0 = 0

		// Verify dependencies
		expect(outerDerived.dependencies?.has(innerDerived)).toBe(true);
		expect(outerDerived.dependencies?.has(state2)).toBe(true);
		expect(innerDerived.dependencies?.has(state1)).toBe(true);

		// Verify dependedBehaviors
		expect(innerDerived.dependedBehaviors.has(outerDerived)).toBe(true);
		expect(state1.dependedBehaviors.has(innerDerived)).toBe(true);
		expect(state2.dependedBehaviors.has(outerDerived)).toBe(true);

		// Update state1 and verify the update propagates through the chain
		source1.emit(5);
		timeline.flush();

		expect(outerDerived.read()).toBe(10); // 5*2 + 0 = 10

		// Update state2 and verify
		source2.emit(3);
		timeline.flush();

		expect(outerDerived.read()).toBe(13); // 5*2 + 3 = 13
	});
});
