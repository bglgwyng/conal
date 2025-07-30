import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DerivedEvent } from "../../src/event/DerivedEvent";
import type { EffectEvent } from "../../src/event/Event";
import { MergedEvent } from "../../src/event/MergedEvent";
import type { Source } from "../../src/event/Source";
import { Timeline } from "../../src/Timeline";

describe("EffectEvent", () => {
	let timeline: Timeline;
	let source: Source<number>;
	let effectEvent: EffectEvent<number>;
	let dispose: () => void;

	beforeEach(() => {
		timeline = new Timeline();
		source = timeline.source<number>();
		[dispose, effectEvent] = source.on((value) => value * 2);
	});

	describe("effect event emission", () => {
		it("should emit transformed value when source emits", () => {
			const spy = vi.fn();
			const [disposeEffect] = effectEvent.on(spy);

			source.emit(21); // effect will transform to 42
			timeline.flush();

			expect(spy).toHaveBeenCalledWith(42);
			disposeEffect();
		});

		it("should emit updated values on subsequent source emits", () => {
			const spy = vi.fn();
			const [disposeEffect] = effectEvent.on(spy);

			source.emit(5); // effect will transform to 10
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(10);

			source.emit(10); // effect will transform to 20
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(20);

			expect(spy).toHaveBeenCalledTimes(2);
			disposeEffect();
		});

		it("should call timeline.needCommit when effect emits", () => {
			const needCommitSpy = vi.spyOn(timeline, "needCommit");
			const spy = vi.fn();
			const [disposeEffect] = effectEvent.on(spy);

			source.emit(21);
			timeline.flush();

			expect(needCommitSpy).toHaveBeenCalledWith(effectEvent);
			expect(spy).toHaveBeenCalledWith(42);
			disposeEffect();
		});
	});

	describe("commit", () => {
		it("should not emit after commit until new source emit", () => {
			const spy = vi.fn();
			const [disposeEffect] = effectEvent.on(spy);

			// First emit
			source.emit(21);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(42);

			// Flush again - should not trigger spy again
			timeline.flush();
			expect(spy).toHaveBeenCalledTimes(1);

			// New source emit should work
			source.emit(25);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(50);
			expect(spy).toHaveBeenCalledTimes(2);

			disposeEffect();
		});

		it("should handle commit when no value was emitted", () => {
			const spy = vi.fn();
			const [disposeEffect] = effectEvent.on(spy);

			// Should not throw
			timeline.flush();

			// Should still work normally after commit
			source.emit(10);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(20);

			disposeEffect();
		});
	});

	describe("lifecycle", () => {
		it("should emit, receive, and commit in sequence", () => {
			const spy = vi.fn();
			const [disposeEffect] = effectEvent.on(spy);

			// Initial state - no emissions yet
			expect(spy).not.toHaveBeenCalled();

			// Source emit triggers effect
			source.emit(50); // effect will transform to 100
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(100);
			expect(spy).toHaveBeenCalledTimes(1);

			// Commit clears internal state
			effectEvent.commit();

			// Can emit again after commit
			source.emit(100); // effect will transform to 200
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(200);
			expect(spy).toHaveBeenCalledTimes(2);

			disposeEffect();
		});
	});

	describe("integration with Event base class", () => {
		it("should inherit Event functionality", () => {
			expect(effectEvent.isActive).toBe(false);

			const [disposeEffect] = effectEvent.on(() => {});
			expect(effectEvent.isActive).toBe(true);

			disposeEffect();
			expect(effectEvent.isActive).toBe(false);
		});

		it("should work as a chained effect", () => {
			const spy = vi.fn();
			const [disposeChain] = effectEvent.on(spy);

			source.emit(10); // source -> effect (20) -> spy
			timeline.flush();

			expect(spy).toHaveBeenCalledWith(20);

			disposeChain();
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
			const [disposeDerived] = derivedEvent.on(spy);

			// Source emits -> Effect transforms -> DerivedEvent transforms
			source.emit(15); // source(15) -> effect(30) -> derived("Result: 30")
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
			const [disposeSecond] = secondDerived.on(spy);

			// Test the full chain
			source.emit(12); // source(12) -> effect(24) -> first("Value: 24") -> second({message: "Value: 24", length: 9})
			timeline.flush();

			expect(spy).toHaveBeenCalledWith({
				message: "Value: 24",
				length: 9,
			});

			disposeSecond();
		});

		it("should handle error in DerivedEvent transformation", () => {
			const derivedEvent = new DerivedEvent(timeline, effectEvent, (value) => {
				if (value > 50) throw new Error("Value too large");
				return value * 10;
			});

			const spy = vi.fn();
			const [disposeDerived] = derivedEvent.on(spy);

			// This should work (25 * 2 = 50, not > 50)
			source.emit(25);
			timeline.flush();
			expect(spy).toHaveBeenCalledWith(500); // 25 -> 50 -> 500

			// This should throw error (30 * 2 = 60, > 50)
			expect(() => {
				source.emit(30);
				timeline.flush();
			}).toThrow("Value too large");

			disposeDerived();
		});
	});

	describe("MergedEvent with EffectEvent", () => {
		let rightSource: Source<string>;

		beforeEach(() => {
			rightSource = timeline.source<string>();
		});

		it("should emit left when EffectEvent emits", () => {
			const mergedEvent = new MergedEvent(
				timeline,
				effectEvent, // left: EffectEvent<number>
				rightSource, // right: Source<string>
				{ debugLabel: "EffectEvent-Source Merge" },
			);

			const spy = vi.fn();
			const [disposeMerged] = mergedEvent.on(spy);

			// Only left (EffectEvent) emits
			source.emit(10); // source(10) -> effect(20) -> merged({type: "left", value: 20})
			timeline.flush();

			expect(spy).toHaveBeenCalledWith({
				type: "left",
				value: 20,
			});

			disposeMerged();
		});

		it("should emit right when right source emits", () => {
			const mergedEvent = new MergedEvent(timeline, effectEvent, rightSource);

			const spy = vi.fn();
			const [disposeMerged] = mergedEvent.on(spy);

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
			const mergedEvent = new MergedEvent(timeline, effectEvent, rightSource);

			const spy = vi.fn();
			const [disposeMerged] = mergedEvent.on(spy);

			// Both events emit in same timeline flush
			source.emit(15); // Will trigger effectEvent with value 30
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
			const mergedEvent = new MergedEvent(timeline, effectEvent, rightSource);

			const spy = vi.fn();
			const [disposeMerged] = mergedEvent.on(spy);

			// First: left only
			source.emit(5); // effect will emit 10
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
			source.emit(20); // effect will emit 40
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
			const mergedEvent = new MergedEvent(timeline, effectEvent, rightSource);

			// Create another EffectEvent from MergedEvent
			const [disposeChain, chainedEffect] = mergedEvent.on((merged) => {
				if (merged.type === "left") return `Left: ${merged.value}`;
				if (merged.type === "right") return `Right: ${merged.value}`;
				return `Both: ${merged.left} & ${merged.right}`;
			});

			const spy = vi.fn();
			const [disposeChainedSpy] = chainedEffect.on(spy);

			// Test the full chain
			source.emit(8); // source(8) -> effect(16) -> merged({type: "left", value: 16}) -> chained("Left: 16")
			timeline.flush();

			expect(spy).toHaveBeenCalledWith("Left: 16");

			// Test with both
			source.emit(12); // effect(24)
			rightSource.emit("test");
			timeline.flush();

			expect(spy).toHaveBeenCalledWith("Both: 24 & test");

			disposeChainedSpy();
			disposeChain();
		});
	});
});
