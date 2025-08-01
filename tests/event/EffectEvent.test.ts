import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { State } from "../../src/behavior/State";
import { DerivedEvent } from "../../src/core/event/DerivedEvent";
import type { EffectEvent } from "../../src/core/event/Event";
import type { Source } from "../../src/core/event/Source";
import { merge, source } from "../../src/factory";
import { Timeline } from "../../src/Timeline";

describe("EffectEvent", () => {
	let timeline: Timeline;
	let source1: Source<number>;
	let effectEvent: EffectEvent<number>;
	let dispose: () => void;

	beforeEach(() => {
		timeline = new Timeline();
		timeline.unsafeActivate();

		source1 = source<number>();
		[effectEvent, dispose] = source1.on((value) => value * 2);
	});

	describe("effect event emission", () => {
		it("should emit transformed value when source emits", () => {
			const spy = vi.fn();
			const [, disposeEffect] = effectEvent.on(spy);

			timeline.unsafeStart();

			source1.emit(21); // effect will transform to 42
			timeline.flush();

			expect(spy).toHaveBeenCalledWith(42);
			disposeEffect();
		});

		it("should emit updated values on subsequent source emits", () => {
			const spy = vi.fn();
			const [, disposeEffect] = effectEvent.on(spy);

			timeline.unsafeStart();

			source1.emit(5); // effect will transform to 10
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(10);

			source1.emit(10); // effect will transform to 20
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(20);

			expect(spy).toHaveBeenCalledTimes(2);
			disposeEffect();
		});

		it("should call timeline.needCommit when effect emits", () => {
			const needCommitSpy = vi.spyOn(timeline, "needCommit");
			const spy = vi.fn();
			const [, disposeEffect] = effectEvent.on(spy);

			timeline.unsafeStart();
			source1.emit(21);
			timeline.flush();

			expect(needCommitSpy).toHaveBeenCalledWith(effectEvent);
			expect(spy).toHaveBeenCalledWith(42);
			disposeEffect();
		});
	});

	describe("commit", () => {
		it("should not emit after commit until new source emit", () => {
			const spy = vi.fn();
			const [, disposeEffect] = effectEvent.on(spy);

			timeline.unsafeStart();

			// First emit
			source1.emit(21);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(42);

			// Flush again - should not trigger spy again
			timeline.flush();
			expect(spy).toHaveBeenCalledTimes(1);

			// New source emit should work
			source1.emit(25);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(50);
			expect(spy).toHaveBeenCalledTimes(2);

			disposeEffect();
		});

		it("should handle commit when no value was emitted", () => {
			const spy = vi.fn();
			const [, disposeEffect] = effectEvent.on(spy);

			timeline.unsafeStart();
			// Should not throw
			timeline.flush();

			// Should still work normally after commit
			source1.emit(10);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(20);

			disposeEffect();
		});
	});

	describe("lifecycle", () => {
		it("should emit, receive, and commit in sequence", () => {
			const spy = vi.fn();

			const [, disposeEffect] = effectEvent.on(spy);

			timeline.unsafeStart();
			// Initial state - no emissions yet
			expect(spy).not.toHaveBeenCalled();

			// Source emit triggers effect
			source1.emit(50); // effect will transform to 100
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(100);
			expect(spy).toHaveBeenCalledTimes(1);

			// Commit clears internal state
			effectEvent.commit();

			// Can emit again after commit
			source1.emit(100); // effect will transform to 200
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(200);
			expect(spy).toHaveBeenCalledTimes(2);

			disposeEffect();
		});
	});

	describe("integration with Event base class", () => {
		it("should inherit Event functionality", () => {
			expect(effectEvent.isActive).toBe(false);

			const [, disposeEffect] = effectEvent.on(() => {});
			expect(effectEvent.isActive).toBe(true);

			disposeEffect();
			expect(effectEvent.isActive).toBe(false);
		});

		it("should work as a chained effect", () => {
			const spy = vi.fn();
			const [, disposeChain] = effectEvent.on(spy);

			timeline.unsafeStart();

			source1.emit(10); // source -> effect (20) -> spy
			timeline.flush();

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
			const [, disposeEffect] = effectEvent.on((transformedValue) => {
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
				const [, disposeNewCallback] = newSource.on((stringValue) => {
					// This callback should be able to access the new state
					expect(newState.read()).toBe(stringValue);
				});
				allCallbacks.push(disposeNewCallback);
			});

			timeline.unsafeStart();

			// Trigger the effect which will create new reactive elements
			source1.emit(5); // effect transforms to 10
			timeline.flush();

			// Verify that new source and state were created
			expect(createdSources).toHaveLength(1);
			expect(createdStates).toHaveLength(1);
			expect(createdSources[0].value).toBe(10);
			expect(createdStates[0].initialValue).toBe("State for 10");
			expect(createdStates[0].state.read()).toBe("State for 10");

			// Test that the newly created source works
			createdSources[0].source.emit("Hello from dynamic source!");
			timeline.flush();

			// The state should now have the emitted value
			expect(createdStates[0].state.read()).toBe("Hello from dynamic source!");

			// Trigger another effect to create more dynamic elements
			source1.emit(15); // effect transforms to 30
			timeline.flush();

			// Should have created another set
			expect(createdSources).toHaveLength(2);
			expect(createdStates).toHaveLength(2);
			expect(createdSources[1].value).toBe(30);
			expect(createdStates[1].initialValue).toBe("State for 30");

			// Test that both dynamic sources work independently
			createdSources[0].source.emit("First dynamic");
			createdSources[1].source.emit("Second dynamic");
			timeline.flush();

			expect(createdStates[0].state.read()).toBe("First dynamic");
			expect(createdStates[1].state.read()).toBe("Second dynamic");

			// Clean up all dynamic callbacks
			allCallbacks.forEach((dispose) => dispose());
			disposeEffect();
		});

		afterEach(() => {
			dispose();
		});
	});

	describe("DerivedEvent from EffectEvent", () => {
		it("should create DerivedEvent from EffectEvent and transform values", () => {
			// Create DerivedEvent that transforms EffectEvent values
			const derivedEvent = new DerivedEvent(
				timeline,
				effectEvent,
				(value) => `Result: ${value}`, // Transform number to string
				{ debugLabel: "NumberToString" },
			);

			const spy = vi.fn();
			const [, disposeDerived] = derivedEvent.on(spy);

			timeline.unsafeStart();

			// Source emits -> Effect transforms -> DerivedEvent transforms
			source1.emit(15); // source(15) -> effect(30) -> derived("Result: 30")
			timeline.flush();

			expect(spy).toHaveBeenCalledWith("Result: 30");

			disposeDerived();
		});

		it("should handle multiple transformations in chain", () => {
			// First derived event: number -> string
			const firstDerived = new DerivedEvent(
				timeline,
				effectEvent,
				(value) => `Value: ${value}`,
			);

			// Second derived event: string -> object
			const secondDerived = new DerivedEvent(timeline, firstDerived, (str) => ({
				message: str,
				length: str.length,
			}));

			const spy = vi.fn();
			const [, disposeSecond] = secondDerived.on(spy);

			timeline.unsafeStart();

			// Test the full chain
			source1.emit(12); // source(12) -> effect(24) -> first("Value: 24") -> second({message: "Value: 24", length: 9})
			timeline.flush();

			expect(spy).toHaveBeenCalledWith({
				message: "Value: 24",
				length: 9,
			});

			disposeSecond();
		});

		it("should handle error in DerivedEvent transformation", () => {
			const derivedEvent = new DerivedEvent(timeline, effectEvent, (_value) => {
				throw new Error("DerivedEvent transformation failed");
			});

			const spy = vi.fn();
			const [, disposeDerived] = derivedEvent.on(spy);

			timeline.unsafeStart();

			source1.emit(25);
			timeline.flush();
			expect(spy).not.toHaveBeenCalled();

			disposeDerived();
		});
	});

	describe("MergedEvent with EffectEvent", () => {
		let rightSource: Source<string>;

		beforeEach(() => {
			rightSource = timeline.source<string>();
		});

		it("should emit left when EffectEvent emits", () => {
			const mergedEvent = merge(
				effectEvent, // left: EffectEvent<number>
				rightSource, // right: Source<string>
			);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.on(spy);

			timeline.unsafeStart();

			// Only left (EffectEvent) emits
			source1.emit(10); // source(10) -> effect(20) -> merged({type: "left", value: 20})
			timeline.flush();

			expect(spy).toHaveBeenCalledWith({
				type: "left",
				value: 20,
			});

			disposeMerged();
		});

		it("should emit right when right source emits", () => {
			const mergedEvent = merge(effectEvent, rightSource);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.on(spy);

			timeline.unsafeStart();

			// Only right source emits
			rightSource.emit("hello");
			timeline.flush();

			expect(spy).toHaveBeenCalledWith({
				type: "right",
				value: "hello",
			});

			disposeMerged();
		});

		it("should emit both when both events emit simultaneously", () => {
			const mergedEvent = merge(effectEvent, rightSource);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.on(spy);

			timeline.unsafeStart();

			// Both events emit in same timeline flush
			source1.emit(15); // Will trigger effectEvent with value 30
			rightSource.emit("world");
			timeline.flush();

			expect(spy).toHaveBeenCalledWith({
				type: "both",
				left: 30,
				right: "world",
			});

			disposeMerged();
		});

		it("should handle multiple emissions from different events", () => {
			const mergedEvent = merge(effectEvent, rightSource);

			const spy = vi.fn();
			const [, disposeMerged] = mergedEvent.on(spy);

			timeline.unsafeStart();

			// First: left only
			source1.emit(5); // effect will emit 10
			timeline.flush();
			expect(spy).toHaveBeenNthCalledWith(1, {
				type: "left",
				value: 10,
			});

			// Second: right only
			rightSource.emit("test");
			timeline.flush();
			expect(spy).toHaveBeenNthCalledWith(2, {
				type: "right",
				value: "test",
			});

			// Third: both together
			source1.emit(20); // effect will emit 40
			rightSource.emit("both");
			timeline.flush();
			expect(spy).toHaveBeenNthCalledWith(3, {
				type: "both",
				left: 40,
				right: "both",
			});

			expect(spy).toHaveBeenCalledTimes(3);
			disposeMerged();
		});

		it("should work with chained EffectEvent from MergedEvent", () => {
			const mergedEvent = merge(effectEvent, rightSource);

			// Create another EffectEvent from MergedEvent
			const [chainedEffect, disposeChain] = mergedEvent.on((merged) => {
				if (merged.type === "left") return `Left: ${merged.value}`;
				if (merged.type === "right") return `Right: ${merged.value}`;
				return `Both: ${merged.left} & ${merged.right}`;
			});

			const spy = vi.fn();
			const [, disposeChainedSpy] = chainedEffect.on(spy);

			timeline.unsafeStart();

			// Test the full chain
			source1.emit(8); // source(8) -> effect(16) -> merged({type: "left", value: 16}) -> chained("Left: 16")
			timeline.flush();

			expect(spy).toHaveBeenCalledWith("Left: 16");

			// Test with both
			source1.emit(12); // effect(24)
			rightSource.emit("test");
			timeline.flush();

			expect(spy).toHaveBeenCalledWith("Both: 24 & test");

			disposeChainedSpy();
			disposeChain();
		});
	});
});
