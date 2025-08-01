import { beforeEach, describe, expect, test, vi } from "vitest";
import { DerivedEvent } from "../../src/event/DerivedEvent";
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

		timeline.unsafeStart();

		source.emit(1);
		timeline.flush();

		expect(state.read()).toBe(1);
	});

	test("should read the current value of the state in the update event", () => {
		const source = timeline.source<number>();
		const state = timeline.state(10, source);

		const updateSpy = vi.fn();

		new DerivedEvent(timeline, state.updated, (value) => {
			return { current: state.read(), next: value };
		}).on(updateSpy);

		timeline.unsafeStart();

		source.emit(20);
		timeline.flush();

		expect(updateSpy).toHaveBeenCalledExactlyOnceWith({
			current: 10,
			next: 20,
		});
	});
});
