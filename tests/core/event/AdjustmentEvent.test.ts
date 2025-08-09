import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { State } from "../../../src/core/behavior/State";
import type { Event } from "../../../src/core/event/Event";
import { MergedEvent } from "../../../src/core/event/MergedEvent";
import type { Source } from "../../../src/core/event/Source";
import { TransformedEvent } from "../../../src/core/event/TransformedEvent";
import { Timeline } from "../../../src/Timeline";

describe("AdjustmentEvent", () => {
	let timeline: Timeline;
	let source: Source<number>;
	let adjustmentEvent: Event<number>;
	let dispose: () => void;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
		source = timeline.source<number>();
		[adjustmentEvent, dispose] = source.adjustOn((value) => value * 2);
	});

	describe("adjustment event emission", () => {
		it("should emit transformed value when source emits", () => {
			const spy = vi.fn();
			const [, disposeEffect] = adjustmentEvent.adjustOn(spy);

			source.emit(21); // effect will transform to 42
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith(42);
			disposeEffect();
		});

		it("should emit updated values on subsequent source emits", () => {
			const spy = vi.fn();
			const [, disposeEffect] = adjustmentEvent.adjustOn(spy);

			source.emit(5); // effect will transform to 10
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(10);

			source.emit(10); // effect will transform to 20
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(20);

			expect(spy).toHaveBeenCalledTimes(2);
			disposeEffect();
		});

		it("should call timeline.needCommit when effect emits", () => {
			const needCommitSpy = vi.spyOn(timeline, "needCommit");
			const spy = vi.fn();
			const [, disposeEffect] = adjustmentEvent.adjustOn(spy);

			source.emit(21);
			timeline.proceed();

			expect(needCommitSpy).toHaveBeenCalledWith(adjustmentEvent);
			expect(spy).toHaveBeenCalledWith(42);
			disposeEffect();
		});
	});

	describe("commit", () => {
		it("should not emit after commit until new source emit", () => {
			const spy = vi.fn();
			const [, disposeEffect] = adjustmentEvent.adjustOn(spy);

			// First emit
			source.emit(21);
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(42);

			// Flush again - should not trigger spy again
			timeline.proceed();
			expect(spy).toHaveBeenCalledTimes(1);

			// New source emit should work
			source.emit(25);
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(50);
			expect(spy).toHaveBeenCalledTimes(2);

			disposeEffect();
		});

		it("should handle commit when no value was emitted", () => {
			const spy = vi.fn();
			const [, disposeEffect] = adjustmentEvent.adjustOn(spy);

			// Should not throw
			timeline.proceed();

			// Should still work normally after commit
			source.emit(10);
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(20);

			disposeEffect();
		});
	});

	describe("lifecycle", () => {
		it("should emit, receive, and commit in sequence", () => {
			const spy = vi.fn();

			const [, disposeEffect] = adjustmentEvent.adjustOn(spy);

			// Initial state - no emissions yet
			expect(spy).not.toHaveBeenCalled();

			// Source emit triggers effect
			source.emit(50); // effect will transform to 100
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(100);
			expect(spy).toHaveBeenCalledTimes(1);

			// Can emit again after commit
			source.emit(100); // effect will transform to 200
			timeline.proceed();
			expect(spy).toHaveBeenCalledWith(200);
			expect(spy).toHaveBeenCalledTimes(2);

			disposeEffect();
		});
	});

	describe("integration with Event base class", () => {
		it("should inherit Event functionality", () => {
			expect(adjustmentEvent.isActive).toBe(false);

			const [, disposeEffect] = adjustmentEvent.adjustOn(() => {});
			expect(adjustmentEvent.isActive).toBe(true);

			disposeEffect();
			expect(adjustmentEvent.isActive).toBe(false);
		});

		it("should work as a chained effect", () => {
			const spy = vi.fn();
			const [, disposeChain] = adjustmentEvent.adjustOn(spy);

			source.emit(10); // source -> effect (20) -> spy
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith(20);

			disposeChain();
		});

		it("should allow creating new state and source within on callback", () => {
			const createdSources: Array<{ value: number; source: Source<string> }> =
				[];
			const createdStates: Array<{
				initialValue: string;
				state: State<string>;
			}> = [];
			const allCallbacks: Array<() => void> = [];

			// Create an effect that dynamically creates new sources and states
			const [, disposeEffect] = adjustmentEvent.adjustOn((transformedValue) => {
				// Create a new source within the callback
				const newSource = timeline.source<string>();
				createdSources.push({ value: transformedValue, source: newSource });

				// Create a new state within the callback
				const initialStateValue = `State for ${transformedValue}`;
				const newState = timeline.state(initialStateValue, newSource);
				createdStates.push({
					initialValue: initialStateValue,
					state: newState,
				});

				// Set up a callback on the newly created source
				const [, disposeNewCallback] = newSource.adjustOn((stringValue) => {
					// This callback should be able to access the new state
					expect(newState.read()).toBe(stringValue);
				});
				allCallbacks.push(disposeNewCallback);
			});

			// Trigger the effect which will create new reactive elements
			source.emit(5); // effect transforms to 10
			timeline.proceed();

			// Verify that new source and state were created
			expect(createdSources).toHaveLength(1);
			expect(createdStates).toHaveLength(1);
			expect(createdSources[0].value).toBe(10);
			expect(createdStates[0].initialValue).toBe("State for 10");
			expect(createdStates[0].state.read()).toBe("State for 10");

			// Test that the newly created source works
			createdSources[0].source.emit("Hello from dynamic source!");
			timeline.proceed();

			// The state should now have the emitted value
			expect(createdStates[0].state.read()).toBe("Hello from dynamic source!");

			// Trigger another effect to create more dynamic elements
			source.emit(15); // effect transforms to 30
			timeline.proceed();

			// Should have created another set
			expect(createdSources).toHaveLength(2);
			expect(createdStates).toHaveLength(2);
			expect(createdSources[1].value).toBe(30);
			expect(createdStates[1].initialValue).toBe("State for 30");

			// Test that both dynamic sources work independently
			createdSources[0].source.emit("First dynamic");
			createdSources[1].source.emit("Second dynamic");
			timeline.proceed();

			expect(createdStates[0].state.read()).toBe("First dynamic");
			expect(createdStates[1].state.read()).toBe("Second dynamic");

			// Clean up all dynamic callbacks
			allCallbacks.forEach(dispose);
			disposeEffect();
		});

		afterEach(() => {
			dispose();
		});
	});

	describe("TransformedEvent from AdjustmentEvent", () => {
		it("should create TransformedEvent from AdjustmentEvent and transform values", () => {
			// Create TransformedEvent that transforms EffectEvent values
			const derivedEvent = new TransformedEvent(
				timeline,
				adjustmentEvent,
				(value) => `Result: ${value}`, // Transform number to string
			);

			const spy = vi.fn();
			const [, disposeDerived] = derivedEvent.adjustOn(spy);

			// Source emits -> Effect transforms -> TransformedEvent transforms
			source.emit(15); // source(15) -> effect(30) -> derived("Result: 30")
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith("Result: 30");

			disposeDerived();
		});

		it("should handle multiple transformations in chain", () => {
			// First derived event: number -> string
			const firstDerived = new TransformedEvent(
				timeline,
				adjustmentEvent,
				(value) => `Value: ${value}`,
			);

			// Second derived event: string -> object
			const secondDerived = new TransformedEvent(
				timeline,
				firstDerived,
				(str) => ({
					message: str,
					length: str.length,
				}),
			);

			const spy = vi.fn();
			const [, disposeSecond] = secondDerived.adjustOn(spy);

			// Test the full chain
			source.emit(12); // source(12) -> effect(24) -> first("Value: 24") -> second({message: "Value: 24", length: 9})
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith({
				message: "Value: 24",
				length: 9,
			});

			disposeSecond();
		});

		it("should handle error in TransformedEvent transformation", () => {
			const derivedEvent = new TransformedEvent(
				timeline,
				adjustmentEvent,
				(value) => {
					throw new Error("TransformedEvent transformation failed");
				},
			);

			const spy = vi.fn();
			const [, disposeDerived] = derivedEvent.adjustOn(spy);

			source.emit(25);
			timeline.proceed();
			expect(spy).not.toHaveBeenCalled();

			disposeDerived();
		});
	});

	describe("MergedEvent with AdjustmentEvent", () => {
		let rightSource: Source<string>;

		beforeEach(() => {
			rightSource = timeline.source<string>();
		});

		it("should emit left when AdjustmentEvent emits", () => {
			const mergedEvent = new MergedEvent(
				timeline,
				adjustmentEvent, // left: AdjustmentEvent<number>
				rightSource, // right: Source<string>
			);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.adjustOn(spy);

			// Only left (AdjustmentEvent) emits
			source.emit(10); // source(10) -> effect(20) -> merged({type: "left", value: 20})
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith({
				type: "left",
				value: 20,
			});

			disposeMerged();
		});

		it("should emit right when right source emits", () => {
			const mergedEvent = new MergedEvent(
				timeline,
				adjustmentEvent,
				rightSource,
			);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.adjustOn(spy);

			// Only right source emits
			rightSource.emit("hello");
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith({
				type: "right",
				value: "hello",
			});

			disposeMerged();
		});

		it("should emit both when both events emit simultaneously", () => {
			const mergedEvent = new MergedEvent(
				timeline,
				adjustmentEvent,
				rightSource,
			);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.adjustOn(spy);

			// Both events emit in same timeline flush
			source.emit(15); // Will trigger effectEvent with value 30
			rightSource.emit("world");
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith({
				type: "both",
				left: 30,
				right: "world",
			});

			disposeMerged();
		});

		it("should handle multiple emissions from different events", () => {
			const mergedEvent = new MergedEvent(
				timeline,
				adjustmentEvent,
				rightSource,
			);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.adjustOn(spy);

			// First: left only
			source.emit(5); // effect will emit 10
			timeline.proceed();
			expect(spy).toHaveBeenNthCalledWith(1, {
				type: "left",
				value: 10,
			});

			// Second: right only
			rightSource.emit("test");
			timeline.proceed();
			expect(spy).toHaveBeenNthCalledWith(2, {
				type: "right",
				value: "test",
			});

			// Third: both together
			source.emit(20); // effect will emit 40
			rightSource.emit("both");
			timeline.proceed();
			expect(spy).toHaveBeenNthCalledWith(3, {
				type: "both",
				left: 40,
				right: "both",
			});

			expect(spy).toHaveBeenCalledTimes(3);
			disposeMerged();
		});

		it("should work with chained EffectEvent from MergedEvent", () => {
			const mergedEvent = new MergedEvent(
				timeline,
				adjustmentEvent,
				rightSource,
			);

			// Create another EffectEvent from MergedEvent
			const [chainedEffect, disposeChain] = mergedEvent.adjustOn((merged) => {
				if (merged.type === "left") return `Left: ${merged.value}`;
				if (merged.type === "right") return `Right: ${merged.value}`;
				return `Both: ${merged.left} & ${merged.right}`;
			});

			const spy = vi.fn();
			const [, disposeChainedSpy] = chainedEffect.adjustOn(spy);

			// Test the full chain
			source.emit(8); // source(8) -> effect(16) -> merged({type: "left", value: 16}) -> chained("Left: 16")
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith("Left: 16");

			// Test with both
			source.emit(12); // effect(24)
			rightSource.emit("test");
			timeline.proceed();

			expect(spy).toHaveBeenCalledWith("Both: 24 & test");

			disposeChainedSpy();
			disposeChain();
		});
	});
});
