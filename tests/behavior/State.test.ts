import { beforeEach, describe, expect, test, vitest } from "vitest";
import { Timeline } from "../../src/Timeline";

describe("State", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	test("update state", () => {
		const source = timeline.source<number>();

		const state = timeline.state(0, source);
		expect(state.read()).toBe(0);

		source.emit(1);
		timeline.flush();

		expect(state.read()).toBe(1);
	});
});
