import { beforeEach, describe, expect, it, vi } from "vitest";
import { Event } from "../src/Event";
import { proceedImmediately, Timeline } from "../src/Timeline";

describe("Event", () => {
	let t: Timeline;
	let event: Event<number>;
	let emit: (value: number) => void;

	beforeEach(() => {
		t = new Timeline({ onSourceEmission: proceedImmediately });
		[event, emit] = t.source<number>();
	});

	describe("transform()", () => {
		it("should transform event values using the provided function", () => {
			const transformedEvent = event.transform((n) => `Number: ${n}`);

			expect(transformedEvent).toBeInstanceOf(Event);

			const callback = vi.fn();
			transformedEvent.on(callback);

			emit(42);

			expect(callback).toHaveBeenCalledWith("Number: 42");
		});

		it("should transform different types correctly", () => {
			const [stringEvent, emitString] = t.source<string>();

			const lengthEvent = stringEvent.transform((s) => s.length);
			const booleanEvent = event.transform((n) => n > 0);

			const lengthCallback = vi.fn();
			const booleanCallback = vi.fn();
			lengthEvent.on(lengthCallback);
			booleanEvent.on(booleanCallback);

			// Test string to length transformation
			emitString("hello");
			expect(lengthCallback).toHaveBeenCalledWith(5);

			// Test number to boolean transformation
			emit(10);
			expect(booleanCallback).toHaveBeenCalledWith(true);

			emit(-5);
			expect(booleanCallback).toHaveBeenCalledWith(false);
		});

		it("should chain transformations correctly", () => {
			const doubled = event.transform((n) => n * 2);
			const toStringEvent = doubled.transform((n) => `Result: ${n}`);

			const callback = vi.fn();
			toStringEvent.on(callback);

			emit(5);

			expect(callback).toHaveBeenCalledWith("Result: 10"); // 5 * 2 = 10
		});

		it("should work with complex objects", () => {
			interface Person {
				name: string;
				age: number;
			}

			const [personEvent, emitPerson] = t.source<Person>();

			const nameEvent = personEvent.transform((person) => person.name);
			const ageEvent = personEvent.transform((person) => person.age);

			const nameCallback = vi.fn();
			const ageCallback = vi.fn();
			nameEvent.on(nameCallback);
			ageEvent.on(ageCallback);

			emitPerson({ name: "Alice", age: 30 });

			expect(nameCallback).toHaveBeenCalledWith("Alice");
			expect(ageCallback).toHaveBeenCalledWith(30);
		});

		it("should maintain separate transformation chains", () => {
			const transform1 = event.transform((n) => n * 2);
			const transform2 = event.transform((n) => n + 10);

			const callback1 = vi.fn();
			const callback2 = vi.fn();
			transform1.on(callback1);
			transform2.on(callback2);

			emit(5);

			expect(callback1).toHaveBeenCalledWith(10); // 5 * 2
			expect(callback2).toHaveBeenCalledWith(15); // 5 + 10
		});

		it("should handle transformation errors gracefully", () => {
			const errorTransform = event.transform((n) => {
				if (n === 42) throw new Error("Test error");
				return n * 2;
			});

			const callback = vi.fn();
			errorTransform.on(callback);

			// This should not crash the timeline
			emit(42);

			// Other values should still work
			emit(5);

			expect(callback).toHaveBeenCalledWith(10);
		});

		it("should preserve timeline reference", () => {
			const transformedEvent = event.transform((n) => n * 2);

			expect(transformedEvent.timeline).toBe(t);
		});

		it("should work with identity transformation", () => {
			const identityEvent = event.transform((n) => n);

			const callback = vi.fn();
			identityEvent.on(callback);

			emit(42);

			expect(callback).toHaveBeenCalledWith(42);
		});

		it("should handle multiple subscribers to transformed event", () => {
			const transformedEvent = event.transform((n) => n * 2);

			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const callback3 = vi.fn();

			transformedEvent.on(callback1);
			transformedEvent.on(callback2);
			transformedEvent.on(callback3);

			emit(5);

			expect(callback1).toHaveBeenCalledWith(10);
			expect(callback2).toHaveBeenCalledWith(10);
			expect(callback3).toHaveBeenCalledWith(10);
		});
	});
});
