import { describe, expect, it, vitest } from "vitest";
import { ConstantBehavior } from "../../src/core/behavior/ConstantBehavior";
import { Timeline } from "../../src/Timeline";

describe("ConstantBehavior", () => {
	it("should always return the initial value", () => {
		const timeline = new Timeline();
		const value = { test: "value" };
		const behavior = new ConstantBehavior(timeline, value);

		timeline.unsafeStart();

		// Test readCurrentValue
		expect(behavior.readCurrentValue()).toBe(value);

		// Test readNextValue
		const nextValue = behavior.readNextValue();
		expect(nextValue.value).toBe(value);
		expect(nextValue.isUpdated).toBe(false);

		// Test read()
		expect(behavior.read()).toBe(value);
	});

	it("should never update its value", () => {
		const timeline = new Timeline();
		const initialValue = 42;
		const behavior = new ConstantBehavior(timeline, initialValue);

		// The updated event should be a never event (no updates)
		const mockCallback = vitest.fn();
		behavior.updated.on(mockCallback);

		timeline.unsafeStart();

		// Advance timeline to see if any updates occur
		timeline.flush();

		// The callback should never be called
		expect(mockCallback).not.toHaveBeenCalled();
	});

	it("should work with different types of values", () => {
		const timeline = new Timeline();

		// Test with number
		const numBehavior = new ConstantBehavior(timeline, 42);

		// Test with string
		const strBehavior = new ConstantBehavior(timeline, "test");

		// Test with object
		const obj = { key: "value" };
		const objBehavior = new ConstantBehavior(timeline, obj);

		timeline.unsafeStart();

		expect(numBehavior.read()).toBe(42);
		expect(strBehavior.read()).toBe("test");
		expect(objBehavior.read()).toBe(obj);
	});

	it("should maintain referential equality", () => {
		const timeline = new Timeline();

		const obj = { data: 1 };
		const behavior = new ConstantBehavior(timeline, obj);

		timeline.unsafeStart();

		// Multiple reads should return the same object reference
		const firstRead = behavior.read();
		const secondRead = behavior.read();

		expect(firstRead).toBe(obj);
		expect(secondRead).toBe(obj);
		expect(firstRead).toBe(secondRead);
	});
});
