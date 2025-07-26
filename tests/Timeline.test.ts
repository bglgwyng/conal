import { describe, expect, test } from "vitest";
import { Timeline } from "../src/Timeline";

describe("Timeline", () => {
	test("increment timestamp", () => {
		const timeline = new Timeline();

		expect(timeline.timestamp).toBe(0);

		timeline.flush();

		expect(timeline.timestamp).toBe(1);
	});
	test("run effects", () => {
		const timeline = new Timeline();
		const source = timeline.source<number>();

		let effectValue: number = 0;

		const dispose = source.on((x) => {
			effectValue = x;
		});

		source.emit(1);
		timeline.flush();

		expect(effectValue).toBe(1);

		dispose();

		source.emit(2);
		timeline.flush();

		expect(effectValue).toBe(1);
	});
});
