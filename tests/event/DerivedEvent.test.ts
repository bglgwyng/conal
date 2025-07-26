import { beforeEach, describe, expect, it, vitest } from "vitest";
import { DerivedEvent } from "../../src/event/DerivedEvent";
import { Event } from "../../src/event/Event";
import { Source } from "../../src/event/Source";
import { Timeline } from "../../src/Timeline";

describe("DerivedEvent", () => {
	let timeline: Timeline;
	let parentEvent: Source<number>;
	let derivedEvent: DerivedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline();
		parentEvent = new Source<number>(timeline);
	});

	it("should transform parent event values using the provided function", () => {
		const transformFn = (n: number) => `Number: ${n}`;
		derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		derivedEvent.on(mockCallback);

		parentEvent.emit(42);

		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42");
	});

	it("should transform parent event values using the provided function", () => {
		const transformFn = (n: number) => `Number: ${n}`;
		derivedEvent = new DerivedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		derivedEvent.on(mockCallback);

		parentEvent.emit(42);

		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42");
	});

	it("should chain multiple DerivedEvents correctly", () => {
		const transformFn1 = (n: number) => `Number: ${n}`;
		const derived1 = new DerivedEvent(timeline, parentEvent, transformFn1);

		const transformFn2 = (s: string) => `${s}!`;
		const derived2 = new DerivedEvent(timeline, derived1, transformFn2);

		const mockCallback = vitest.fn();
		derived2.on(mockCallback);

		parentEvent.emit(42);
		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42!");
	});
});
