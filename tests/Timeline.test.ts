import { describe, expect, test, vitest } from "vitest";
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
		const mockEffect = vitest.fn();

		source.on(mockEffect);

		source.emit(1);
		timeline.flush();

		expect(mockEffect).toHaveBeenCalledWith(1);
		expect(mockEffect).toHaveBeenCalledTimes(1);

		mockEffect.mockClear();

		source.emit(2);
		timeline.flush();

		expect(mockEffect).toHaveBeenCalledWith(2); // Update this line
		expect(mockEffect).toHaveBeenCalledTimes(1); // Update this line
	});
});
