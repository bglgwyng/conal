import { beforeEach, describe, expect, it, vi } from "vitest";
import { Source } from "../src/core/event/Source";
import { Event } from "../src/Event";
import { Timeline } from "../src/Timeline";

describe("Event", () => {
	let timeline: Timeline;
	let source: Source<number>;
	let event: Event<number>;

	beforeEach(() => {
		timeline = new Timeline();
		source = new Source<number>(timeline);
		event = new Event(source);
	});

	describe("transform()", () => {
		it("should transform event values using the provided function", () => {
			const transformedEvent = event.transform((n) => `Number: ${n}`);

			expect(transformedEvent).toBeInstanceOf(Event);

			const callback = vi.fn();
			transformedEvent.on(callback);

			source.emit(42);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith("Number: 42");
		});

		it("should transform different types correctly", () => {
			const stringSource = new Source<string>(timeline);
			const stringEvent = new Event(stringSource);

			const lengthEvent = stringEvent.transform((s) => s.length);
			const booleanEvent = event.transform((n) => n > 0);

			const lengthCallback = vi.fn();
			const booleanCallback = vi.fn();
			lengthEvent.on(lengthCallback);
			booleanEvent.on(booleanCallback);

			// Test string to length transformation
			stringSource.emit("hello");
			timeline.proceed();
			expect(lengthCallback).toHaveBeenCalledWith(5);

			// Test number to boolean transformation
			source.emit(10);
			timeline.proceed();
			expect(booleanCallback).toHaveBeenCalledWith(true);

			source.emit(-5);
			timeline.proceed();
			expect(booleanCallback).toHaveBeenCalledWith(false);
		});

		it("should chain transformations correctly", () => {
			const doubled = event.transform((n) => n * 2);
			const toStringEvent = doubled.transform((n) => `Result: ${n}`);

			const callback = vi.fn();
			toStringEvent.on(callback);

			source.emit(5);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith("Result: 10"); // 5 * 2 = 10
		});

		it("should work with complex objects", () => {
			interface Person {
				name: string;
				age: number;
			}

			const personSource = new Source<Person>(timeline);
			const personEvent = new Event(personSource);

			const nameEvent = personEvent.transform((person) => person.name);
			const ageEvent = personEvent.transform((person) => person.age);

			const nameCallback = vi.fn();
			const ageCallback = vi.fn();
			nameEvent.on(nameCallback);
			ageEvent.on(ageCallback);

			personSource.emit({ name: "Alice", age: 30 });
			timeline.proceed();

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

			source.emit(5);
			timeline.proceed();

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
			source.emit(42);

			// Other values should still work
			source.emit(5);
			timeline.proceed();
			expect(callback).toHaveBeenCalledWith(10);
		});

		it("should preserve timeline reference", () => {
			const transformedEvent = event.transform((n) => n * 2);

			expect(transformedEvent.timeline).toBe(timeline);
		});

		it("should work with identity transformation", () => {
			const identityEvent = event.transform((n) => n);

			const callback = vi.fn();
			identityEvent.on(callback);

			source.emit(42);
			timeline.proceed();

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

			source.emit(5);
			timeline.proceed();

			expect(callback1).toHaveBeenCalledWith(10);
			expect(callback2).toHaveBeenCalledWith(10);
			expect(callback3).toHaveBeenCalledWith(10);
		});
	});
});
