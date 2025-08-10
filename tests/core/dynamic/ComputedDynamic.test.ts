import { beforeEach, describe, expect, it } from "vitest";
import { ComputedDynamic } from "../../../src/core/dynamic/ComputedDynamic";
import { Timeline } from "../../../src/Timeline";

describe("ComputedDynamic", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
	});

	it("should compute computed value from state", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a computed dynamic that doubles the state value
		const computed = new ComputedDynamic(
			timeline,
			(read) => read(state1) + read(state2),
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
		// Create a computed dynamic that depends on two states
		const computed = new ComputedDynamic(
			timeline,
			(read) => read(state1) + read(state2),
		);

		// Initially inactive, so no dependencies should be tracked
		expect(computed.isActive).toBe(false);
		expect(computed.dependencies).toBeUndefined();

		// Read when inactive - should not track dependencies
		const result = computed.read();
		expect(result).toBe(0);

		// Should still not track dependencies when inactive
		expect(computed.dependencies).toBeUndefined();
		expect(state1.dependedDynamics.has(computed)).toBe(false);
		expect(state2.dependedDynamics.has(computed)).toBe(false);
	});

	it("should track dependencies when active", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a computed dynamic that depends on two states
		const computed = new ComputedDynamic(
			timeline,
			(read) => read(state1) + read(state2),
		);

		// Make it active by adding an effect
		const [, dispose] = computed.updated.on(() => {});
		expect(computed.isActive).toBe(true);

		// Read when active - should track dependencies
		const result = computed.read();
		expect(result).toBe(0);

		// Should now track dependencies when active
		expect(computed.dependencies?.size).toBe(2);
		expect(computed.dependencies?.has(state1)).toBe(true);
		expect(computed.dependencies?.has(state2)).toBe(true);
		expect(state1.dependedDynamics.has(computed)).toBe(true);
		expect(state2.dependedDynamics.has(computed)).toBe(true);

		// Clean up
		dispose();
	});
	it("should track dependencies correctly with nested reads", () => {
		// Create source states
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);

		// Create a computed dynamic that will be used inside another computed dynamic
		const innerComputed = new ComputedDynamic(
			timeline,
			(read) => read(state1) * 2, // Double the value of state1
		);
		innerComputed.updated.on(() => {});

		// Create an outer computed dynamic that uses the inner computed dynamic
		const outerComputed = new ComputedDynamic(
			timeline,
			(read) => read(innerComputed) + read(state2), // Use innerComputed + state2
		);
		outerComputed.updated.on(() => {});

		// Initial read - should track all dependencies
		expect(outerComputed.read()).toBe(0); // 0*2 + 0 = 0

		// Verify dependencies
		expect(outerComputed.dependencies?.has(innerComputed)).toBe(true);
		expect(outerComputed.dependencies?.has(state2)).toBe(true);
		expect(innerComputed.dependencies?.has(state1)).toBe(true);

		// Verify dependedDynamics
		expect(innerComputed.dependedDynamics.has(outerComputed)).toBe(true);
		expect(state1.dependedDynamics.has(innerComputed)).toBe(true);
		expect(state2.dependedDynamics.has(outerComputed)).toBe(true);

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
