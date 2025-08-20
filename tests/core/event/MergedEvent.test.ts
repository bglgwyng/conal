import { beforeEach, describe, expect, it, vitest } from "vitest";
import { MergedEvent, type These } from "../../../src/core/event/MergedEvent";
import { Source } from "../../../src/core/event/Source";
import { Timeline } from "../../../src/core/Timeline";

describe("MergedEvent", () => {
	let timeline: Timeline;
	let leftSource: Source<string>;
	let rightSource: Source<number>;
	let mergedEvent: MergedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
		leftSource = new Source<string>(timeline);
		rightSource = new Source<number>(timeline);
	});

	it("should merge left and right events into a 'both' type when both emit values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		// Emit left value first
		leftSource.emit("hello");
		rightSource.emit(42);
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "both",
			left: "hello",
			right: 42,
		});
	});

	it("should handle left-only values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		// Emit only left value
		leftSource.emit("left only");
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "left",
			value: "left only",
		});
	});

	it("should handle right-only values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		// Emit only right value
		rightSource.emit(100);
		timeline.proceed();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "right",
			value: 100,
		});
	});

	it("should update values when sources emit multiple times", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		leftSource.emit("first");
		rightSource.emit(1);
		timeline.proceed();

		expect(mockCallback).toHaveBeenLastCalledWith({
			type: "both",
			left: "first",
			right: 1,
		});
	});

	it("should handle interleaved emissions correctly", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const results: These<string, number>[] = [];
		mergedEvent.on((value) => results.push(value));

		// Emit in interleaved order
		leftSource.emit("a");
		timeline.proceed();

		rightSource.emit(1);
		timeline.proceed();

		leftSource.emit("b");
		timeline.proceed();

		leftSource.emit("c");
		rightSource.emit(2);
		timeline.proceed();

		expect(results).toEqual([
			{ type: "left", value: "a" },
			{ type: "right", value: 1 },
			{ type: "left", value: "b" },
			{ type: "both", left: "c", right: 2 },
		]);
	});
});
