import { describe, expect, test } from "vitest";
import { Timeline } from "../src/Timeline";

describe("Timeline", () => {
	test("increment timestamp", () => {
		const timeline = new Timeline({ onSourceEmission() {} });

		expect(timeline.timestamp).toBe(0);

		timeline.proceed();

		expect(timeline.timestamp).toBe(1);
	});
});
