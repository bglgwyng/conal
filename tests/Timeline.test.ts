import { describe, expect, test } from "vitest";
import { Timeline } from "../src/Timeline";

describe("Timeline", () => {
	test("increment timestamp", () => {
		const timeline = new Timeline();

		timeline.unsafeStart();

		expect(timeline.timestamp).toBe(0);

		timeline.flush();

		expect(timeline.timestamp).toBe(1);
	});
});
