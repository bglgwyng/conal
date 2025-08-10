import { beforeEach, describe, expect, it, vi } from "vitest";
import { State } from "../../../src/core/dynamic/State";
import type { Event } from "../../../src/core/event/Event";
import { Source } from "../../../src/core/event/Source";
import { SwitchableEvent } from "../../../src/core/event/SwitchableEvent";
import { Timeline } from "../../../src/Timeline";

describe("SwitchableEvent", () => {
	let timeline: Timeline;
	let dynamic: State<Event<number>>;
	let source1: Source<number>;
	let source2: Source<number>;
	let switchEvent: Source<Event<number>>;
	let switchableEvent: SwitchableEvent<Event<number>, number>;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });

		// Create two source events for testing
		source1 = new Source<number>(timeline);
		source2 = new Source<number>(timeline);

		// Create a switch event to change between sources
		switchEvent = new Source<Event<number>>(timeline);

		// Create a State dynamic that holds the current source
		dynamic = new State<Event<number>>(timeline, source1, switchEvent);

		// Create the SwitchableEvent that will switch between sources
		switchableEvent = new SwitchableEvent(timeline, dynamic, (x) => x);
	});

	it("should forward events from the current source", () => {
		const callback = vi.fn();
		switchableEvent.on(callback);

		// Emit from the first source
		source1.emit(42);
		timeline.proceed();

		expect(callback).toHaveBeenCalledWith(42);
	});

	it("should switch to a new source when dynamic updates", () => {
		const callback = vi.fn();
		switchableEvent.on(callback);

		// Switch to the second source
		switchEvent.emit(source2);
		timeline.proceed();

		// Emit from the second source
		source2.emit(100);
		timeline.proceed();

		expect(callback).toHaveBeenCalledWith(100);
	});

	it("should not receive events after unsubscribing", () => {
		const callback = vi.fn();
		const [, dispose] = switchableEvent.on(callback);

		// Emit and verify
		source1.emit(1);
		timeline.proceed();
		expect(callback).toHaveBeenCalledTimes(1);

		// Dispose and emit again
		dispose();
		source1.emit(2);
		timeline.proceed();

		// Should still only have been called once
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("should emit the last value from the current source when switching", () => {
		const callback = vi.fn();
		switchableEvent.on(callback);

		// Switch to second source
		source1.emit(1);
		switchEvent.emit(source2);
		timeline.proceed();

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenLastCalledWith(1);
	});

	it("should clean up old source when switching", () => {
		const callback = vi.fn();
		switchableEvent.on(callback);

		// Switch to second source
		switchEvent.emit(source2);
		timeline.proceed();

		// Emit from first source (should be ignored)
		source1.emit(1);
		// Emit from second source (should be received)
		source2.emit(2);
		timeline.proceed();

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith(2);
	});
});
