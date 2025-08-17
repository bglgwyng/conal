import { beforeEach, describe, expect, it, vitest } from "vitest";
import { Source } from "../../../src/core/event/Source";
import {
	Discard,
	TransformedEvent,
} from "../../../src/core/event/TransformedEvent";
import { Timeline } from "../../../src/core/Timeline";

describe("TransformedEvent", () => {
	let timeline: Timeline;
	let parentEvent: Source<number>;
	let transformedEvent: TransformedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
		parentEvent = new Source<number>(timeline);
	});

	it("should transform parent event values using the provided function", () => {
		const transformFn = (n: number) => `Number: ${n}`;
		transformedEvent = new TransformedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		transformedEvent.on(mockCallback);

		parentEvent.emit(42);

		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42");
	});

	it("should transform parent event values using the provided function", () => {
		const transformFn = (n: number) => `Number: ${n}`;
		transformedEvent = new TransformedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		transformedEvent.on(mockCallback);

		parentEvent.emit(42);

		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42");
	});

	it("should chain multiple TransformedEvents correctly", () => {
		const transformFn1 = (n: number) => `Number: ${n}`;
		const transformed1 = new TransformedEvent(
			timeline,
			parentEvent,
			transformFn1,
		);

		const transformFn2 = (s: string) => `${s}!`;
		const transformed2 = new TransformedEvent(
			timeline,
			transformed1,
			transformFn2,
		);

		const mockCallback = vitest.fn();
		transformed2.on(mockCallback);

		parentEvent.emit(42);
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith("Number: 42!");
	});

	it("should not propagate when Discard is thrown", async () => {
		const transformFn = (n: number) => {
			if (n % 2 === 0) throw Discard;
			return `Number: ${n}`;
		};

		transformedEvent = new TransformedEvent(timeline, parentEvent, transformFn);

		const mockCallback = vitest.fn();
		transformedEvent.on(mockCallback);

		// This should be discarded (even number)
		parentEvent.emit(42);
		timeline.proceed();
		expect(mockCallback).not.toHaveBeenCalled();

		// This should propagate (odd number)
		parentEvent.emit(7);
		timeline.proceed();
		expect(mockCallback).toHaveBeenCalledWith("Number: 7");
	});
});
