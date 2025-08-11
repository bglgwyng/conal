import { beforeEach, describe, expect, it, vi } from "vitest";
import { proceedImmediately } from "../src";
import { Dynamic } from "../src/Dynamic";
import { Event } from "../src/Event";
import { Timeline } from "../src/Timeline";

describe("Dynamic", () => {
	let t: Timeline;

	beforeEach(() => {
		t = new Timeline({ onSourceEmission: proceedImmediately });
	});

	describe("constructor", () => {
		it("should create a Dynamic instance with internal dynamic", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(10, event);

			expect(dynamic).toBeInstanceOf(Dynamic);
			expect(dynamic.internal).toBeDefined();
		});
	});

	describe("updated()", () => {
		it("should return an Event instance", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(10, event);

			expect(dynamic.updated).toBeInstanceOf(Event);
		});

		it("should emit when the dynamic value changes", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(10, event);

			const callback = vi.fn();
			dynamic.updated.on(callback);

			emit(20);

			expect(callback).toHaveBeenCalledWith(20);
		});

		it("should emit multiple times for multiple updates", () => {
			const [event, emit] = t.source<string>();
			const dynamic = t.state("initial", event);

			const callback = vi.fn();
			dynamic.updated.on(callback);

			emit("first");

			emit("second");

			emit("third");

			expect(callback).toHaveBeenCalledTimes(3);
			expect(callback).toHaveBeenNthCalledWith(1, "first");
			expect(callback).toHaveBeenNthCalledWith(2, "second");
			expect(callback).toHaveBeenNthCalledWith(3, "third");
		});
	});

	describe("read()", () => {
		it("should return the current value of the dynamic", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(42, event);

			const value = dynamic.read();

			expect(value).toBe(42);
		});

		it("should return updated value after state change", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(10, event);

			expect(dynamic.read()).toBe(10);

			emit(25);

			expect(dynamic.read()).toBe(25);
		});

		it("should work with computed dynamics", () => {
			const [event, emit] = t.source<number>();
			const baseDynamic = t.state(5, event);
			const computedDynamic = t.computed(() => baseDynamic.read() * 2);

			expect(computedDynamic.read()).toBe(10);

			emit(7);

			expect(computedDynamic.read()).toBe(14);
		});

		it("should handle complex object values", () => {
			interface Person {
				name: string;
				age: number;
			}

			const [event, emit] = t.source<Person>();
			const dynamic = t.state({ name: "Alice", age: 30 }, event);

			const person = dynamic.read();

			expect(person).toEqual({ name: "Alice", age: 30 });

			emit({ name: "Bob", age: 25 });

			const updatedPerson = dynamic.read();
			expect(updatedPerson).toEqual({ name: "Bob", age: 25 });
		});
	});

	describe("on()", () => {
		it("should return a new dynamic and dispose function", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(10, event);

			const [newDynamic, dispose] = dynamic.on((value) => value * 2);

			expect(newDynamic).toBeInstanceOf(Dynamic);
			expect(typeof dispose).toBe("function");
		});

		it("should create a dynamic with transformed initial value", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(5, event);

			const [doubledDynamic, dispose] = dynamic.on((value) => value * 2);

			expect(doubledDynamic.read()).toBe(10);
		});

		it("should update the new dynamic when original dynamic changes", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(3, event);

			const [squaredDynamic, dispose] = dynamic.on((value) => value * value);

			expect(squaredDynamic.read()).toBe(9);

			emit(4);

			expect(squaredDynamic.read()).toBe(16);

			emit(5);

			expect(squaredDynamic.read()).toBe(25);
		});

		it("should support chaining transformations", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(2, event);

			const [doubled, dispose1] = dynamic.on((value) => value * 2);
			const [plusTen, dispose2] = doubled.on((value) => value + 10);

			expect(plusTen.read()).toBe(14); // (2 * 2) + 10

			emit(3);

			expect(plusTen.read()).toBe(16); // (3 * 2) + 10
		});

		it("should work with different transformation types", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(42, event);

			const [stringDynamic, dispose1] = dynamic.on(
				(value) => `Number: ${value}`,
			);
			const [booleanDynamic, dispose2] = dynamic.on((value) => value > 50);

			expect(stringDynamic.read()).toBe("Number: 42");
			expect(booleanDynamic.read()).toBe(false);

			emit(75);

			expect(stringDynamic.read()).toBe("Number: 75");
			expect(booleanDynamic.read()).toBe(true);
		});

		it("should handle complex object transformations", () => {
			interface Person {
				name: string;
				age: number;
			}

			const [event, emit] = t.source<Person>();
			const dynamic = t.state({ name: "Alice", age: 30 }, event);

			const [nameDynamic, dispose1] = dynamic.on((person) => person.name);
			const [isAdultDynamic, dispose2] = dynamic.on(
				(person) => person.age >= 18,
			);

			expect(nameDynamic.read()).toBe("Alice");
			expect(isAdultDynamic.read()).toBe(true);

			emit({ name: "Charlie", age: 16 });

			expect(nameDynamic.read()).toBe("Charlie");
			expect(isAdultDynamic.read()).toBe(false);
		});

		it("should allow dispose function to clean up subscriptions", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(1, event);

			const [transformedDynamic, dispose] = dynamic.on((value) => value * 10);

			expect(transformedDynamic.read()).toBe(10);

			// Dispose the subscription
			dispose();

			// The transformed dynamic should still have its last value
			expect(transformedDynamic.read()).toBe(10);

			// But it shouldn't update when the original dynamic changes
			emit(5);

			// The transformed dynamic should not have updated
			expect(transformedDynamic.read()).toBe(10);
		});

		it("should handle transformation errors gracefully", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(1, event);

			const [errorDynamic, dispose] = dynamic.on((value) => {
				if (value === 42) throw new Error("Test error");
				return value * 2;
			});

			expect(errorDynamic.read()).toBe(2);

			// This should not crash
			emit(42);

			// Other values should still work
			emit(5);

			expect(errorDynamic.read()).toBe(10);
		});

		it("should work with computed dynamics", () => {
			const [event, emit] = t.source<number>();
			const baseDynamic = t.state(3, event);
			const computedDynamic = t.computed(() => baseDynamic.read() + 1);

			const [doubledComputed, dispose] = computedDynamic.on(
				(value) => value * 2,
			);

			expect(doubledComputed.read()).toBe(8); // (3 + 1) * 2

			emit(4);

			expect(doubledComputed.read()).toBe(10); // (4 + 1) * 2
		});
	});

	describe("integration tests", () => {
		it("should work with multiple dynamics and transformations", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<number>();

			const dynamic1 = t.state(10, event1);
			const dynamic2 = t.state(20, event2);

			const sumDynamic = t.computed(() => dynamic1.read() + dynamic2.read());
			const [doubledSum, dispose] = sumDynamic.on((value) => value * 2);

			expect(doubledSum.read()).toBe(60); // (10 + 20) * 2

			emit1(15);

			expect(doubledSum.read()).toBe(70); // (15 + 20) * 2

			emit2(25);

			expect(doubledSum.read()).toBe(80); // (15 + 25) * 2
		});

		it("should maintain proper timeline context", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(5, event);

			// The dynamic should work within the timeline context
			expect(() => dynamic.read()).not.toThrow();
			expect(() => dynamic.updated).not.toThrow();
			expect(() => dynamic.on((x) => x)).not.toThrow();
		});
	});
});
