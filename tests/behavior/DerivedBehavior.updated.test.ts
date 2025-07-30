import { beforeEach, describe, expect, it, vi } from "vitest";
import { DerivedBehavior } from "../../src/behavior/DerivedBehavior";
import { DerivedEvent } from "../../src/event/DerivedEvent";
import { Timeline } from "../../src/Timeline";

describe("DerivedBehavior - updated event", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	it("should trigger updated event when value changes", () => {
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
		const [unsubscribe] = derived.updated.on(updateSpy);

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

	it("should track dependencies when effect is added without explicit read", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(10, source1);
		const state2 = timeline.state(20, source2);

		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Initially, no dependencies should be tracked
		expect(derived.dependencies).toBeUndefined();

		// Add an effect to the updated event - this should trigger activate()
		const updateSpy = vi.fn();
		const [unsubscribe] = derived.updated.on(updateSpy);

		// After adding the effect, dependencies should be tracked due to activate() call
		expect(derived.dependencies).toBeDefined();
		expect(derived.dependencies?.size).toBe(2);
		expect(derived.dependencies?.has(state1)).toBe(true);
		expect(derived.dependencies?.has(state2)).toBe(true);

		// Verify that the derived behavior is registered as a dependent
		expect(state1.dependedBehaviors.has(derived)).toBe(true);
		expect(state2.dependedBehaviors.has(derived)).toBe(true);

		// Update one of the sources
		source1.emit(15);
		timeline.flush();

		// Should trigger update because dependencies were properly tracked
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenLastCalledWith(35); // 15 + 20

		// Clean up
		unsubscribe();
	});

	it("should not track dependencies if no effect is added", () => {
		const source1 = timeline.source<number>();
		const state1 = timeline.state(10, source1);

		const derived = new DerivedBehavior(timeline, () => state1.read() * 2);

		// No effect added, so no dependencies should be tracked
		expect(derived.dependencies).toBeUndefined();
		expect(state1.dependedBehaviors.has(derived)).toBe(false);

		// Update the source
		source1.emit(20);
		timeline.flush();

		// Still no dependencies tracked since no effect was added
		expect(derived.dependencies).toBeUndefined();
		expect(state1.dependedBehaviors.has(derived)).toBe(false);
	});

	it("should track dependencies when derived behavior writes to a state", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(10, source1);
		const state2 = timeline.state(20, source2);

		// Create a derived behavior that computes sum
		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Create a target state that will receive updates from derived
		const targetState = timeline.state(0, derived.updated);

		// After writeOn, dependencies should be tracked due to activate() call
		expect(derived.dependencies).toBeDefined();
		expect(derived.dependencies?.size).toBe(2);
		expect(derived.dependencies?.has(state1)).toBe(true);
		expect(derived.dependencies?.has(state2)).toBe(true);

		// Verify that the derived behavior is registered as a dependent
		expect(state1.dependedBehaviors.has(derived)).toBe(true);
		expect(state2.dependedBehaviors.has(derived)).toBe(true);

		// Verify that the updated event has the targetState in its dependenedStates
		expect(derived.updated.dependenedStates.has(targetState)).toBe(true);

		// Update one of the sources
		source1.emit(25);
		timeline.flush();

		// Target state should be updated with the new derived value
		expect(targetState.read()).toBe(45); // 25 + 20

		// Update the other source
		source2.emit(30);
		timeline.flush();

		// Target state should be updated again
		expect(targetState.read()).toBe(55); // 25 + 30
	});

	it("should track dependencies with both effect and writeOn", () => {
		const source = timeline.source<number>();
		const state = timeline.state(5, source);

		const derived = new DerivedBehavior(timeline, () => state.read() * 3);

		// Create target state for writeOn
		const targetState = timeline.state(0, derived.updated);

		// Add both effect and writeOn
		const updateSpy = vi.fn();
		const [unsubscribeEffect] = derived.updated.on(updateSpy);

		// Dependencies should be tracked
		expect(derived.dependencies).toBeDefined();
		expect(derived.dependencies?.size).toBe(1);
		expect(derived.dependencies?.has(state)).toBe(true);
		expect(state.dependedBehaviors.has(derived)).toBe(true);

		// Both effect and writeOn should be registered
		expect(derived.updated.effects.length).toBe(1);
		expect(derived.updated.dependenedStates.has(targetState)).toBe(true);

		// Update source
		source.emit(10);
		timeline.flush();

		// Both effect and writeOn should work
		expect(updateSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenLastCalledWith(30); // 10 * 3
		expect(targetState.read()).toBe(30);

		// Clean up
		unsubscribeEffect();
	});

	it("should call activate and deactivate methods correctly", () => {
		const source1 = timeline.source<number>();
		const source2 = timeline.source<number>();
		const state1 = timeline.state(10, source1);
		const state2 = timeline.state(20, source2);

		const derived = new DerivedBehavior(
			timeline,
			() => state1.read() + state2.read(),
		);

		// Spy on activate and deactivate methods
		const activateSpy = vi.spyOn(derived, "activate");
		const deactivateSpy = vi.spyOn(derived, "deactivate");

		// Initially no dependencies should be tracked
		expect(derived.dependencies).toBeUndefined();
		expect(state1.dependedBehaviors.has(derived)).toBe(false);
		expect(state2.dependedBehaviors.has(derived)).toBe(false);

		// Add an effect - this should trigger activate()
		const updateSpy = vi.fn();
		const [unsubscribe] = derived.updated.on(updateSpy);

		// activate() should have been called
		expect(activateSpy).toHaveBeenCalledTimes(1);

		// Dependencies should now be tracked
		expect(derived.dependencies).toBeDefined();
		expect(derived.dependencies?.size).toBe(2);
		expect(state1.dependedBehaviors.has(derived)).toBe(true);
		expect(state2.dependedBehaviors.has(derived)).toBe(true);

		// Remove the effect - this should trigger deactivate()
		unsubscribe();

		// deactivate() should have been called
		expect(deactivateSpy).toHaveBeenCalledTimes(1);

		// Dependencies should be cleaned up
		expect(derived.dependencies).toBeUndefined();
		expect(state1.dependedBehaviors.has(derived)).toBe(false);
		expect(state2.dependedBehaviors.has(derived)).toBe(false);
	});

	it("should handle multiple activations and deactivations", () => {
		const source = timeline.source<number>();
		const state = timeline.state(5, source);

		const derived = new DerivedBehavior(timeline, () => state.read() * 2);

		const activateSpy = vi.spyOn(derived, "activate");
		const deactivateSpy = vi.spyOn(derived, "deactivate");

		// Add first effect
		const [unsubscribe1] = derived.updated.on(() => {});
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);

		// Add second effect - should not trigger activate again
		const [unsubscribe2] = derived.updated.on(() => {});
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);

		// Remove first effect - should not trigger deactivate yet
		unsubscribe1();
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);
		expect(state.dependedBehaviors.has(derived)).toBe(true);

		// Remove second effect - should trigger deactivate
		unsubscribe2();
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(1);
		expect(state.dependedBehaviors.has(derived)).toBe(false);
	});

	it("should handle activation through writeOn", () => {
		const source = timeline.source<number>();
		const state = timeline.state(10, source);

		const derived = new DerivedBehavior(timeline, () => state.read() + 5);

		const activateSpy = vi.spyOn(derived, "activate");
		const deactivateSpy = vi.spyOn(derived, "deactivate");

		// Create target state using writeOn - this should trigger activate
		const targetState = timeline.state(0, derived.updated);

		// activate() should have been called
		expect(activateSpy).toHaveBeenCalledTimes(1);
		expect(deactivateSpy).toHaveBeenCalledTimes(0);

		// Dependencies should be tracked
		expect(derived.dependencies).toBeDefined();
		expect(state.dependedBehaviors.has(derived)).toBe(true);

		// Update source to verify the connection works
		source.emit(20);
		timeline.flush();
		expect(targetState.read()).toBe(25); // 20 + 5
	});

	it("should read the current value of the derived behavior in the update event", () => {
		const source = timeline.source<number>();
		const state = timeline.state(10, source);

		const derived = new DerivedBehavior(timeline, () => state.read() + 5);

		const updateSpy = vi.fn();

		new DerivedEvent(timeline, derived.updated, (value) => {
			return { current: derived.read(), next: value };
		}).on(updateSpy);

		source.emit(20);
		timeline.flush();

		expect(updateSpy).toHaveBeenCalledExactlyOnceWith({
			current: 15,
			next: 25,
		});
	});
});
