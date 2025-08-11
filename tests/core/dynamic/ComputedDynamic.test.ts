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
			() => state1.read() + state2.read(),
		);

		expect(computed.readCurrent()).toBe(0);

		// Set initial state value
		source1.emit(5); // This will update both state1 and state2
		source2.emit(10);
		timeline.proceed();

		// Check if computed value is computed correctly
		expect(computed.readCurrent()).toBe(15);
	});

	it("should not track dependencies when inactive", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);
		// Create a computed dynamic that depends on two states
		const computed = new ComputedDynamic(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Initially inactive, so no dependencies should be tracked
		expect(computed.isActive).toBe(false);
		expect(computed.dependencies).toBeUndefined();

		// Read when inactive - should not track dependencies
		const result = computed.readCurrent();
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
			() => state1.read() + state2.read(),
		);

		// Make it active by adding an effect
		const [, dispose] = computed.updated.on(() => {});
		expect(computed.isActive).toBe(true);

		// Read when active - should track dependencies
		const result = computed.readCurrent();
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
			() => state1.read() * 2, // Double the value of state1
		);
		innerComputed.updated.on(() => {});

		// Create an outer computed dynamic that uses the inner computed dynamic
		const outerComputed = new ComputedDynamic(
			timeline,
			() => innerComputed.read() + state2.read(), // Use innerComputed + state2
		);
		outerComputed.updated.on(() => {});

		// Initial read - should track all dependencies
		expect(outerComputed.readCurrent()).toBe(0); // 0*2 + 0 = 0

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

		expect(outerComputed.readCurrent()).toBe(10); // 5*2 + 0 = 10

		// Update state2 and verify
		source2.emit(3);
		timeline.proceed();

		expect(outerComputed.readCurrent()).toBe(13); // 5*2 + 3 = 13
	});

	describe("nested computed updated events", () => {
		it("should emit updated events in correct order for doubly nested computed dynamics", () => {
			const source1 = timeline.source<number>();
			const source2 = timeline.source<number>();
			const state1 = timeline.state(0, source1);
			const state2 = timeline.state(0, source2);

			// Create inner computed (level 1)
			const innerComputed = new ComputedDynamic(
				timeline,
				() => state1.read() * 2,
			);

			// Create middle computed (level 2)
			const middleComputed = new ComputedDynamic(
				timeline,
				() => innerComputed.read() + state2.read(),
			);

			// Create outer computed (level 3)
			const outerComputed = new ComputedDynamic(
				timeline,
				() => middleComputed.read() * 3,
			);

			const innerUpdates: number[] = [];
			const middleUpdates: number[] = [];
			const outerUpdates: number[] = [];

			// Subscribe to updated events
			innerComputed.updated.on((value) => innerUpdates.push(value));
			middleComputed.updated.on((value) => middleUpdates.push(value));
			outerComputed.updated.on((value) => outerUpdates.push(value));

			// Initial state: state1=0, state2=0
			// innerComputed = 0*2 = 0
			// middleComputed = 0+0 = 0
			// outerComputed = 0*3 = 0

			// Update state1
			source1.emit(5);
			timeline.proceed();

			// Expected: state1=5, state2=0
			// innerComputed = 5*2 = 10
			// middleComputed = 10+0 = 10
			// outerComputed = 10*3 = 30

			expect(innerUpdates).toEqual([10]);
			expect(middleUpdates).toEqual([10]);
			expect(outerUpdates).toEqual([30]);

			// Update state2
			source2.emit(3);
			timeline.proceed();

			// Expected: state1=5, state2=3
			// innerComputed = 5*2 = 10 (no change)
			// middleComputed = 10+3 = 13
			// outerComputed = 13*3 = 39

			expect(innerUpdates).toEqual([10]); // No new update
			expect(middleUpdates).toEqual([10, 13]);
			expect(outerUpdates).toEqual([30, 39]);

			// Update state1 again
			source1.emit(2);
			timeline.proceed();

			// Expected: state1=2, state2=3
			// innerComputed = 2*2 = 4
			// middleComputed = 4+3 = 7
			// outerComputed = 7*3 = 21

			expect(innerUpdates).toEqual([10, 4]);
			expect(middleUpdates).toEqual([10, 13, 7]);
			expect(outerUpdates).toEqual([30, 39, 21]);
		});

		it("should handle complex nested computed with multiple dependencies", () => {
			const sourceA = timeline.source<number>();
			const sourceB = timeline.source<number>();
			const sourceC = timeline.source<number>();

			const stateA = timeline.state(1, sourceA);
			const stateB = timeline.state(2, sourceB);
			const stateC = timeline.state(3, sourceC);

			// First level computeds
			const computed1 = new ComputedDynamic(
				timeline,
				() => stateA.read() + stateB.read(), // A + B
			);

			const computed2 = new ComputedDynamic(
				timeline,
				() => stateB.read() * stateC.read(), // B * C
			);

			// Second level computed (depends on both first level computeds)
			const finalComputed = new ComputedDynamic(
				timeline,
				() => computed1.read() + computed2.read(), // (A + B) + (B * C)
			);

			const computed1Updates: number[] = [];
			const computed2Updates: number[] = [];
			const finalUpdates: number[] = [];

			computed1.updated.on((value) => computed1Updates.push(value));
			computed2.updated.on((value) => computed2Updates.push(value));
			finalComputed.updated.on((value) => finalUpdates.push(value));

			// Initial: A=1, B=2, C=3
			// computed1 = 1+2 = 3
			// computed2 = 2*3 = 6
			// finalComputed = 3+6 = 9

			// Update A
			sourceA.emit(5);
			timeline.proceed();

			// New: A=5, B=2, C=3
			// computed1 = 5+2 = 7
			// computed2 = 2*3 = 6 (no change)
			// finalComputed = 7+6 = 13

			expect(computed1Updates).toEqual([7]);
			expect(computed2Updates).toEqual([]); // No change
			expect(finalUpdates).toEqual([13]);

			// Update B (affects both computed1 and computed2)
			sourceB.emit(4);
			timeline.proceed();

			// New: A=5, B=4, C=3
			// computed1 = 5+4 = 9
			// computed2 = 4*3 = 12
			// finalComputed = 9+12 = 21

			expect(computed1Updates).toEqual([7, 9]);
			expect(computed2Updates).toEqual([12]);
			expect(finalUpdates).toEqual([13, 21]);

			// Update C (affects only computed2)
			sourceC.emit(1);
			timeline.proceed();

			// New: A=5, B=4, C=1
			// computed1 = 5+4 = 9 (no change)
			// computed2 = 4*1 = 4
			// finalComputed = 9+4 = 13

			expect(computed1Updates).toEqual([7, 9]); // No change
			expect(computed2Updates).toEqual([12, 4]);
			expect(finalUpdates).toEqual([13, 21, 13]);
		});

		it("should not emit updated events when nested computed values don't change", () => {
			const source = timeline.source<number>();
			const state = timeline.state(10, source);

			// Create nested computeds that might not change
			const computed1 = new ComputedDynamic(
				timeline,
				() => Math.floor(state.read() / 5), // Integer division by 5
			);

			const computed2 = new ComputedDynamic(
				timeline,
				() => computed1.read() * 10, // Multiply by 10
			);

			const computed1Updates: number[] = [];
			const computed2Updates: number[] = [];

			computed1.updated.on((value) => computed1Updates.push(value));
			computed2.updated.on((value) => computed2Updates.push(value));

			// Initial: state=10, computed1=2, computed2=20

			// Update state to 11 (computed1 should still be 2)
			source.emit(11);
			timeline.proceed();

			expect(computed1Updates).toEqual([]); // No change: floor(11/5) = 2
			expect(computed2Updates).toEqual([]); // No change since computed1 didn't change

			// Update state to 12 (computed1 should still be 2)
			source.emit(12);
			timeline.proceed();

			expect(computed1Updates).toEqual([]); // No change: floor(12/5) = 2
			expect(computed2Updates).toEqual([]); // No change since computed1 didn't change

			// Update state to 15 (computed1 should change to 3)
			source.emit(15);
			timeline.proceed();

			expect(computed1Updates).toEqual([3]); // Changed: floor(15/5) = 3
			expect(computed2Updates).toEqual([30]); // Changed: 3 * 10 = 30
		});

		it("should handle deeply nested computed dynamics (3+ levels)", () => {
			const source = timeline.source<number>();
			const state = timeline.state(1, source);

			// Level 1
			const level1 = new ComputedDynamic(timeline, () => state.read() * 2);

			// Level 2
			const level2 = new ComputedDynamic(timeline, () => level1.read() + 1);

			// Level 3
			const level3 = new ComputedDynamic(timeline, () => level2.read() * 3);

			// Level 4
			const level4 = new ComputedDynamic(timeline, () => level3.read() - 5);

			const level1Updates: number[] = [];
			const level2Updates: number[] = [];
			const level3Updates: number[] = [];
			const level4Updates: number[] = [];

			level1.updated.on((value) => level1Updates.push(value));
			level2.updated.on((value) => level2Updates.push(value));
			level3.updated.on((value) => level3Updates.push(value));
			level4.updated.on((value) => level4Updates.push(value));

			// Initial: state=1
			// level1 = 1*2 = 2
			// level2 = 2+1 = 3
			// level3 = 3*3 = 9
			// level4 = 9-5 = 4

			// Update state
			source.emit(3);
			timeline.proceed();

			// New: state=3
			// level1 = 3*2 = 6
			// level2 = 6+1 = 7
			// level3 = 7*3 = 21
			// level4 = 21-5 = 16

			expect(level1Updates).toEqual([6]);
			expect(level2Updates).toEqual([7]);
			expect(level3Updates).toEqual([21]);
			expect(level4Updates).toEqual([16]);

			// Verify final values
			expect(level1.readCurrent()).toBe(6);
			expect(level2.readCurrent()).toBe(7);
			expect(level3.readCurrent()).toBe(21);
			expect(level4.readCurrent()).toBe(16);
		});
	});
});
