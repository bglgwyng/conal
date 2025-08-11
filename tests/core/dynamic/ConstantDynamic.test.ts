import { describe, expect, it, vitest } from "vitest";
import { ConstantDynamic } from "../../../src/core/dynamic/ConstantDynamic";
import { Timeline } from "../../../src/core/Timeline";

describe("ConstantDynamic", () => {
	it("should always return the initial value", () => {
		const timeline = new Timeline({ onSourceEmission() {} });
		const value = { test: "value" };
		const dynamic = new ConstantDynamic(timeline, value);

		// Test readCurrentValue
		expect(dynamic.readCurrent()).toBe(value);

		// Test readNextValue
		const nextValue = dynamic.readNext();
		expect(nextValue.value).toBe(value);
		expect(nextValue.isUpdated).toBe(false);

		// Test read()
		expect(dynamic.readCurrent()).toBe(value);
	});

	it("should never update its value", () => {
		const timeline = new Timeline({ onSourceEmission() {} });
		const initialValue = 42;
		const dynamic = new ConstantDynamic(timeline, initialValue);

		// The updated event should be a never event (no updates)
		const mockCallback = vitest.fn();
		dynamic.updated.on(mockCallback);

		// Advance timeline to see if any updates occur
		timeline.proceed();

		// The callback should never be called
		expect(mockCallback).not.toHaveBeenCalled();
	});

	it("should work with different types of values", () => {
		const timeline = new Timeline({ onSourceEmission() {} });

		// Test with number
		const numDynamic = new ConstantDynamic(timeline, 42);

		// Test with string
		const strDynamic = new ConstantDynamic(timeline, "test");

		// Test with object
		const obj = { key: "value" };
		const objDynamic = new ConstantDynamic(timeline, obj);

		expect(numDynamic.readCurrent()).toBe(42);
		expect(strDynamic.readCurrent()).toBe("test");
		expect(objDynamic.readCurrent()).toBe(obj);
	});

	it("should maintain referential equality", () => {
		const timeline = new Timeline({ onSourceEmission() {} });

		const obj = { data: 1 };
		const dynamic = new ConstantDynamic(timeline, obj);

		// Multiple reads should return the same object reference
		const firstRead = dynamic.readCurrent();
		const secondRead = dynamic.readCurrent();

		expect(firstRead).toBe(obj);
		expect(secondRead).toBe(obj);
		expect(firstRead).toBe(secondRead);
	});
});
