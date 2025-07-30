import { beforeEach, describe, expect, it, vitest } from "vitest";
import { MergedEvent } from "../../src/event/MergedEvent";
import { Source } from "../../src/event/Source";
import { Timeline } from "../../src/Timeline";

describe("MergedEvent", () => {
	let timeline: Timeline;
	let leftSource: Source<string>;
	let rightSource: Source<number>;
	let mergedEvent: MergedEvent<string, number>;

	beforeEach(() => {
		timeline = new Timeline();
		leftSource = new Source<string>(timeline);
		rightSource = new Source<number>(timeline);
	});

	it("should merge left and right events into a 'both' type when both emit values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.start();

		// Emit left value first
		leftSource.emit("hello");
		rightSource.emit(42);
		timeline.flush();

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

		timeline.start();

		// Emit only left value
		leftSource.emit("left only");
		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "left",
			value: "left only",
		});
	});

	it("should handle right-only values", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.start();

		// Emit only right value
		rightSource.emit(100);
		timeline.flush();

		expect(mockCallback).toHaveBeenCalledWith({
			type: "right",
			value: 100,
		});
	});

	it("should update values when sources emit multiple times", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const mockCallback = vitest.fn();
		mergedEvent.on(mockCallback);

		timeline.start();

		leftSource.emit("first");
		rightSource.emit(1);
		timeline.flush();

		expect(mockCallback).toHaveBeenLastCalledWith({
			type: "both",
			left: "first",
			right: 1,
		});
	});

	it("should handle interleaved emissions correctly", () => {
		mergedEvent = new MergedEvent(timeline, leftSource, rightSource);

		const results: any[] = [];
		mergedEvent.on((value) => results.push(value));

		timeline.start();

		// Emit in interleaved order
		leftSource.emit("a");
		timeline.flush();

		rightSource.emit(1);
		timeline.flush();

		leftSource.emit("b");
		timeline.flush();

		leftSource.emit("c");
		rightSource.emit(2);
		timeline.flush();

		expect(results).toEqual([
			{ type: "left", value: "a" },
			{ type: "right", value: 1 },
			{ type: "left", value: "b" },
			{ type: "both", left: "c", right: 2 },
		]);
	});
});
