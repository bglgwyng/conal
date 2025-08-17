import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComputedDynamic } from "../../../src/core/dynamic/ComputedDynamic";
import { TransformedEvent } from "../../../src/core/event/TransformedEvent";
import { Timeline } from "../../../src/core/Timeline";

describe("ComputedDynamic - updated event", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
	});

	it("should trigger updated event when value changes", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(0, source1);
		const state2 = timeline.state(0, source2);

		const computed = new ComputedDynamic(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Set up a spy to track the updated event
		const updateSpy = vi.fn();
		const [, dispose] = computed.updated.on(updateSpy);

		// Initial read to set up dependencies
		expect(computed.readCurrent()).toBe(0);
		expect(updateSpy).not.toHaveBeenCalled();

		// Update first state and flush
		source1.emit(5);
		timeline.proceed();

		// Should trigger update with new value (5 + 0)
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenLastCalledWith(5);

		// Update second state and flush
		source2.emit(3);
		timeline.proceed();

		// Should trigger update with new value (5 + 3)
		expect(updateSpy).toHaveBeenCalledTimes(2);
		expect(updateSpy).toHaveBeenLastCalledWith(8);

		// // Clean up
		dispose();

		// Update again after unsubscribing
		source1.emit(10);
		timeline.proceed();

		// Should not trigger update after unsubscribe
		expect(updateSpy).toHaveBeenCalledTimes(2);
	});

	it("should track dependencies when effect is added without explicit read", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(10, source1);
		const state2 = timeline.state(20, source2);

		const computed = new ComputedDynamic(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Initially, no dependencies should be tracked
		expect(computed.dependencies).toBeUndefined();

		// Add an effect to the updated event - this should trigger activate()
		const updateSpy = vi.fn();
		const [, dispose] = computed.updated.on(updateSpy);

		// After adding the effect, dependencies should be tracked due to activate() call
		expect(computed.dependencies).toBeDefined();
		expect(computed.dependencies?.size).toBe(2);
		expect(computed.dependencies?.has(state1)).toBe(true);
		expect(computed.dependencies?.has(state2)).toBe(true);

		// Verify that the computed dynamic is registered as a dependent
		expect(state1.dependedDynamics.has(computed)).toBe(true);
		expect(state2.dependedDynamics.has(computed)).toBe(true);

		// Update one of the sources
		source1.emit(15);
		timeline.proceed();

		// Should trigger update because dependencies were properly tracked
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenLastCalledWith(35); // 15 + 20

		// Clean up
		dispose();
	});

	it("should not track dependencies if no effect is added", () => {
		const source1 = timeline.source<number>();
		const state1 = timeline.state(10, source1);

		const computed = new ComputedDynamic(timeline, () => state1.read() * 2);

		// No effect added, so no dependencies should be tracked
		expect(computed.dependencies).toBeUndefined();
		expect(state1.dependedDynamics.has(computed)).toBe(false);

		// Update the source
		source1.emit(20);
		timeline.proceed();

		// Still no dependencies tracked since no effect was added
		expect(computed.dependencies).toBeUndefined();
		expect(state1.dependedDynamics.has(computed)).toBe(false);
	});

	it("should track dependencies when computed dynamic writes to a state", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(10, source1);
		const state2 = timeline.state(20, source2);

		// Create a computed dynamic that computes sum
		const computed = new ComputedDynamic(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Create a target state that will receive updates from computed
		const targetState = timeline.state(0, computed.updated);

		// After writeOn, dependencies should be tracked due to activate() call
		expect(computed.dependencies).toBeDefined();
		expect(computed.dependencies?.size).toBe(2);
		expect(computed.dependencies?.has(state1)).toBe(true);
		expect(computed.dependencies?.has(state2)).toBe(true);

		// Verify that the computed dynamic is registered as a dependent
		expect(state1.dependedDynamics.has(computed)).toBe(true);
		expect(state2.dependedDynamics.has(computed)).toBe(true);

		// Verify that the updated event has the targetState in its dependenedStates
		expect(computed.updated.dependenedStates.has(targetState)).toBe(true);

		// Update one of the sources
		source1.emit(25);
		timeline.proceed();

		// Target state should be updated with the new computed value
		expect(targetState.readCurrent()).toBe(45); // 25 + 20

		// Update the other source
		source2.emit(30);
		timeline.proceed();

		// Target state should be updated again
		expect(targetState.readCurrent()).toBe(55); // 25 + 30
	});

	it("should track dependencies with both effect and writeOn", () => {
		const source = timeline.source<number>();
		const state = timeline.state(5, source);

		const computed = new ComputedDynamic(timeline, () => state.read() * 3);

		// Create target state for writeOn
		const targetState = timeline.state(0, computed.updated);

		// Add both effect and writeOn
		const updateSpy = vi.fn();
		const [, unsubscribe] = computed.updated.on(updateSpy);

		// Dependencies should be tracked
		expect(computed.dependencies).toBeDefined();
		expect(computed.dependencies?.size).toBe(1);
		expect(computed.dependencies?.has(state)).toBe(true);
		expect(state.dependedDynamics.has(computed)).toBe(true);

		// Both effect and writeOn should be registered
		expect(computed.updated.effects.length).toBe(1);
		expect(computed.updated.dependenedStates.has(targetState)).toBe(true);

		// Update source
		source.emit(10);
		timeline.proceed();

		// Both effect and writeOn should work
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenLastCalledWith(30); // 10 * 3
		expect(targetState.readCurrent()).toBe(30);

		// Clean up
		unsubscribe();
	});

	it("should call activate and deactivate methods correctly", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(10, source1);
		const state2 = timeline.state(20, source2);

		const computed = new ComputedDynamic(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Spy on activate and deactivate methods
		const activateSpy = vi.spyOn(computed, "activate");
		const deactivateSpy = vi.spyOn(computed, "deactivate");

		// Initially no dependencies should be tracked
		expect(computed.dependencies).toBeUndefined();
		expect(state1.dependedDynamics.has(computed)).toBe(false);
		expect(state2.dependedDynamics.has(computed)).toBe(false);

		// Add an effect - this should trigger activate()
		const updateSpy = vi.fn();
		const [, dispose] = computed.updated.on(updateSpy);

		// activate() should have been called
		expect(activateSpy).toHaveBeenCalledTimes(1);

		// Dependencies should now be tracked
		expect(computed.dependencies).toBeDefined();
		expect(computed.dependencies?.size).toBe(2);
		expect(state1.dependedDynamics.has(computed)).toBe(true);
		expect(state2.dependedDynamics.has(computed)).toBe(true);

		// Remove the effect - this should trigger deactivate()
		dispose();

		// deactivate() should have been called
		expect(deactivateSpy).toHaveBeenCalledTimes(1);

		// Dependencies should be cleaned up
		expect(computed.dependencies).toBeUndefined();
		expect(state1.dependedDynamics.has(computed)).toBe(false);
		expect(state2.dependedDynamics.has(computed)).toBe(false);
	});

	it("should handle multiple activations and deactivations", () => {
		const source = timeline.source<number>();
		const state = timeline.state(5, source);

		const computed = new ComputedDynamic(timeline, () => state.read() * 2);

		const activateSpy = vi.spyOn(computed, "activate");
		const deactivateSpy = vi.spyOn(computed, "deactivate");

		// Add first effect
		const [, dispose1] = computed.updated.on(() => {});
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);

		// Add second effect - should not trigger activate again
		const [, dispose2] = computed.updated.on(() => {});
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);

		// Remove first effect - should not trigger deactivate yet
		dispose1();
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);
		expect(state.dependedDynamics.has(computed)).toBe(true);

		// Remove second effect - should trigger deactivate
		dispose2();
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(1);
		expect(state.dependedDynamics.has(computed)).toBe(false);
	});

	it("should handle activation through writeOn", () => {
		const source = timeline.source<number>();
		const state = timeline.state(10, source);

		const computed = new ComputedDynamic(timeline, () => state.read() + 5);

		const activateSpy = vi.spyOn(computed, "activate");
		const deactivateSpy = vi.spyOn(computed, "deactivate");

		// Create target state using writeOn - this should trigger activate
		const targetState = timeline.state(0, computed.updated);

		// activate() should have been called
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);

		// Dependencies should be tracked
		expect(computed.dependencies).toBeDefined();
		expect(state.dependedDynamics.has(computed)).toBe(true);

		// Update source to verify the connection works
		source.emit(20);
		timeline.proceed();
		expect(targetState.readCurrent()).toBe(25); // 20 + 5
	});

	it("should read the current value of the computed dynamic in the update event", () => {
		const source = timeline.source<number>();
		const state = timeline.state(10, source);

		const computed = new ComputedDynamic(
			timeline,
			() => state.read() + 5,
		).setTag("computed");

		const updateSpy = vi.fn();

		new TransformedEvent(timeline, computed.updated, (value) => {
			return { current: computed.readCurrent(), next: value };
		}).on(updateSpy);

		source.emit(20);
		timeline.proceed();

		expect(updateSpy).toHaveBeenCalledExactlyOnceWith({
			current: 15,
			next: 25,
		});
	});
});
