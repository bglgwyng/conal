import { beforeEach, describe, expect, it, vi } from "vitest";
import type { State } from "../../src/behavior/State";
import { DynamicEvent } from "../../src/event/DynamicEvent";
import type { Source } from "../../src/event/Source";
import { source, state } from "../../src/factory";
import { Timeline } from "../../src/Timeline";

describe("DynamicEvent", () => {
	let timeline: Timeline;
	let behavior: State<Source<number>>;
	let source1: Source<number>;
	let source2: Source<number>;
	let switchEvent: Source<Source<number>>;
	let dynamicEvent: DynamicEvent<number>;

	beforeEach(() => {
		timeline = new Timeline();
		timeline.unsafeActivate();

		// Create two source events for testing
		source1 = source();
		source2 = source();

		// Create a switch event to change between sources
		switchEvent = source<Source<number>>();

		// Create a State behavior that holds the current source
		behavior = state<Source<number>>(source1, switchEvent);

		// Create the DynamicEvent that will switch between sources
		dynamicEvent = new DynamicEvent(timeline, behavior);
	});

	it("should forward events from the current source", () => {
		const callback = vi.fn();
		dynamicEvent.on(callback);

		timeline.unsafeStart();

		// Emit from the first source
		source1.emit(42);
		timeline.flush();

		expect(callback).toHaveBeenCalledWith(42);
	});

	it("should switch to a new source when behavior updates", () => {
		const callback = vi.fn();
		dynamicEvent.on(callback);

		timeline.unsafeStart();

		// Switch to the second source
		switchEvent.emit(source2);
		timeline.flush();

		// Emit from the second source
		source2.emit(100);
		timeline.flush();

		expect(callback).toHaveBeenCalledWith(100);
	});

	it("should not receive events after unsubscribing", () => {
		const callback = vi.fn();
		const [, unsubscribe] = dynamicEvent.on(callback);

		timeline.unsafeStart();

		// Emit and verify
		source1.emit(1);
		timeline.flush();
		expect(callback).toHaveBeenCalledTimes(1);

		// Unsubscribe and emit again
		unsubscribe();
		source1.emit(2);
		timeline.flush();

		// Should still only have been called once
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("should emit the last value from the current source when switching", () => {
		const callback = vi.fn();
		dynamicEvent.on(callback);

		timeline.unsafeStart();

		// Switch to second source
		source1.emit(1);
		switchEvent.emit(source2);
		timeline.flush();

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenLastCalledWith(1);
	});

	it("should clean up old source when switching", () => {
		const callback = vi.fn();
		dynamicEvent.on(callback);

		timeline.unsafeStart();

		// Switch to second source
		switchEvent.emit(source2);
		timeline.flush();

		// Emit from first source (should be ignored)
		source1.emit(1);
		// Emit from second source (should be received)
		source2.emit(2);
		timeline.flush();

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith(2);
	});
});
