import { beforeEach, describe, expect, it } from "vitest";
import { ComputedBehavior } from "../../../src/core/behavior/ComputedBehavior";
import { Timeline } from "../../../src/Timeline";

describe("ComputedBehavior", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
	});

	it("should compute computed value from state", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a computed behavior that doubles the state value
		const computed = new ComputedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		expect(computed.read()).toBe(0);

		// Set initial state value
		source1.emit(5); // This will update both state1 and state2
		source2.emit(10);
		timeline.proceed();

		// Check if computed value is computed correctly
		expect(computed.read()).toBe(15);
	});

	it("should not track dependencies when inactive", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a computed behavior that depends on two states
		const computed = new ComputedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Initially inactive, so no dependencies should be tracked
		expect(computed.isActive).toBe(false);
		expect(computed.dependencies).toBeUndefined();

		// Read when inactive - should not track dependencies
		const result = computed.read();
		expect(result).toBe(0);

		// Should still not track dependencies when inactive
		expect(computed.dependencies).toBeUndefined();
		expect(state1.dependedBehaviors.has(computed)).toBe(false);
		expect(state2.dependedBehaviors.has(computed)).toBe(false);
	});

	it("should track dependencies when active", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a computed behavior that depends on two states
		const computed = new ComputedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Make it active by adding an effect
		const unsubscribe = computed.updated.on(() => {});
		expect(computed.isActive).toBe(true);

		// Read when active - should track dependencies
		const result = computed.read();
		expect(result).toBe(0);

		// Should now track dependencies when active
		expect(computed.dependencies?.size).toBe(2);
		expect(computed.dependencies?.has(state1)).toBe(true);
		expect(computed.dependencies?.has(state2)).toBe(true);
		expect(state1.dependedBehaviors.has(computed)).toBe(true);
		expect(state2.dependedBehaviors.has(computed)).toBe(true);

		// Clean up
		unsubscribe();
	});
	it("should track dependencies correctly with nested reads", () => {
		// Create source states
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);

		// Create a computed behavior that will be used inside another computed behavior
		const innerComputed = new ComputedBehavior(
			timeline,
			() => state1.read() * 2, // Double the value of state1
		);
		innerComputed.updated.on(() => {});

		// Create an outer computed behavior that uses the inner computed behavior
		const outerComputed = new ComputedBehavior(
			timeline,
			() => innerComputed.read() + state2.read(), // Use innerComputed + state2
		);
		outerComputed.updated.on(() => {});

		// Initial read - should track all dependencies
		expect(outerComputed.read()).toBe(0); // 0*2 + 0 = 0

		// Verify dependencies
		expect(outerComputed.dependencies?.has(innerComputed)).toBe(true);
		expect(outerComputed.dependencies?.has(state2)).toBe(true);
		expect(innerComputed.dependencies?.has(state1)).toBe(true);

		// Verify dependedBehaviors
		expect(innerComputed.dependedBehaviors.has(outerComputed)).toBe(true);
		expect(state1.dependedBehaviors.has(innerComputed)).toBe(true);
		expect(state2.dependedBehaviors.has(outerComputed)).toBe(true);

		// Update state1 and verify the update propagates through the chain
		source1.emit(5);
		timeline.proceed();

		expect(outerComputed.read()).toBe(10); // 5*2 + 0 = 10

		// Update state2 and verify
		source2.emit(3);
		timeline.proceed();

		expect(outerComputed.read()).toBe(13); // 5*2 + 3 = 13
	});
});
