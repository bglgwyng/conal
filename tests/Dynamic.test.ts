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
			const [event, _emit] = t.source<number>();
			const dynamic = t.state(10, event);

			expect(dynamic).toBeInstanceOf(Dynamic);
			expect(dynamic.internal).toBeDefined();
		});
	});

	describe("updated()", () => {
		it("should return an Event instance", () => {
			const [event, _emit] = t.source<number>();
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
			const [event, _emit] = t.source<number>();
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
			const [event, _emit] = t.source<number>();
			const dynamic = t.state(10, event);

			const [newDynamic, dispose] = dynamic.on((value) => value * 2);

			expect(newDynamic).toBeInstanceOf(Dynamic);
			expect(typeof dispose).toBe("function");
		});

		it("should create a dynamic with transformed initial value", () => {
			const [event, _emit] = t.source<number>();
			const dynamic = t.state(5, event);

			const [doubledDynamic, _dispose] = dynamic.on((value) => value * 2);

			expect(doubledDynamic.read()).toBe(10);
		});

		it("should update the new dynamic when original dynamic changes", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(3, event);

			const [squaredDynamic, _dispose] = dynamic.on((value) => value * value);

			expect(squaredDynamic.read()).toBe(9);

			emit(4);

			expect(squaredDynamic.read()).toBe(16);

			emit(5);

			expect(squaredDynamic.read()).toBe(25);
		});

		it("should support chaining transformations", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(2, event);

			const [doubled, _dispose1] = dynamic.on((value) => value * 2);
			const [plusTen, _dispose2] = doubled.on((value) => value + 10);

			expect(plusTen.read()).toBe(14); // (2 * 2) + 10

			emit(3);

			expect(plusTen.read()).toBe(16); // (3 * 2) + 10
		});

		it("should work with different transformation types", () => {
			const [event, emit] = t.source<number>();
			const dynamic = t.state(42, event);

			const [stringDynamic, _dispose1] = dynamic.on(
				(value) => `Number: ${value}`,
			);
			const [booleanDynamic, _dispose2] = dynamic.on((value) => value > 50);

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

			const [nameDynamic, _dispose1] = dynamic.on((person) => person.name);
			const [isAdultDynamic, _dispose2] = dynamic.on(
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

			const [errorDynamic, _dispose] = dynamic.on((value) => {
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

			const [doubledComputed, _dispose] = computedDynamic.on(
				(value) => value * 2,
			);

			expect(doubledComputed.read()).toBe(8); // (3 + 1) * 2

			emit(4);

			expect(doubledComputed.read()).toBe(10); // (4 + 1) * 2
		});
	});

	describe("computed with custom equal function", () => {
		it("should use default Object.is equality when no equal function provided", () => {
			const [event, emit] = t.source<number>();
			const baseDynamic = t.state(1, event);

			const computedDynamic = t.computed(() => baseDynamic.read());
			const callback = vi.fn();
			computedDynamic.updated.on(callback);

			// Same value should not trigger update
			emit(1);
			expect(callback).not.toHaveBeenCalled();

			// Different value should trigger update
			emit(2);
			expect(callback).toHaveBeenCalledWith(2);
		});

		it("should use custom equal function to determine updates", () => {
			type Tuple = [number, number];

			const [event, emit] = t.source<Tuple>();
			const baseDynamic = t.state<Tuple>([1, 2], event);

			// Computed that creates new tuple each time (different JS objects)
			const computedDynamic = t.computed(
				() => [...baseDynamic.read()] as Tuple, // Always creates new array
				(a, b) => a[0] === b[0] && a[1] === b[1], // Deep equality for tuples
			);

			const callback = vi.fn();
			computedDynamic.updated.on(callback);

			// Same tuple values should not trigger update (even though different objects)
			emit([1, 2]);
			expect(callback).not.toHaveBeenCalled();

			// Different tuple values should trigger update
			emit([2, 3]);
			expect(callback).toHaveBeenCalledWith([2, 3]);

			// Reset callback
			callback.mockClear();

			// Same values again should not trigger update
			emit([2, 3]);
			expect(callback).not.toHaveBeenCalled();

			// Different values should trigger update
			emit([1, 1]);
			expect(callback).toHaveBeenCalledWith([1, 1]);
		});

		it("should work with object equality", () => {
			interface Point {
				x: number;
				y: number;
			}

			const [event, emit] = t.source<Point>();
			const baseDynamic = t.state({ x: 1, y: 2 }, event);

			// Custom equal function for Point objects
			const computedDynamic = t.computed(
				() => ({ ...baseDynamic.read() }), // Create new object each time
				(a, b) => a.x === b.x && a.y === b.y, // Deep equality
			);

			const callback = vi.fn();
			computedDynamic.updated.on(callback);

			// Same values should not trigger update
			emit({ x: 1, y: 2 });
			expect(callback).not.toHaveBeenCalled();

			// Different values should trigger update
			emit({ x: 2, y: 3 });
			expect(callback).toHaveBeenCalledWith({ x: 2, y: 3 });
		});

		it("should work with string case-insensitive equality", () => {
			const [event, emit] = t.source<string>();
			const baseDynamic = t.state("Hello", event);

			const computedDynamic = t.computed(
				() => baseDynamic.read().toUpperCase(),
				(a, b) => a.toLowerCase() === b.toLowerCase(),
			);

			const callback = vi.fn();
			computedDynamic.updated.on(callback);

			// Same case-insensitive value should not trigger update
			emit("hello"); // "HELLO" vs "HELLO" (case-insensitive)
			expect(callback).not.toHaveBeenCalled();

			// Different value should trigger update
			emit("world");
			expect(callback).toHaveBeenCalledWith("WORLD");
		});

		it("should handle array equality with custom function", () => {
			const [event, emit] = t.source<number[]>();
			const baseDynamic = t.state([1, 2, 3], event);

			// Custom equal function for arrays (shallow equality)
			const computedDynamic = t.computed(
				() => [...baseDynamic.read()], // Create new array each time
				(a, b) => a.length === b.length && a.every((val, i) => val === b[i]),
			);

			const callback = vi.fn();
			computedDynamic.updated.on(callback);

			// Same array content should not trigger update
			emit([1, 2, 3]);
			expect(callback).not.toHaveBeenCalled();

			// Different array content should trigger update
			emit([1, 2, 4]);
			expect(callback).toHaveBeenCalledWith([1, 2, 4]);
		});

		it("should handle complex nested computations with custom equality", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<number>();

			const dynamic1 = t.state(1, event1);
			const dynamic2 = t.state(2, event2);

			// Computed dynamic that rounds to nearest integer
			const sumDynamic = t.computed(
				() => Math.round(dynamic1.read() + dynamic2.read()),
				(a, b) => Math.floor(a) === Math.floor(b), // Only update if integer part changes
			);

			const callback = vi.fn();
			sumDynamic.updated.on(callback);

			// Change that doesn't affect integer part
			emit1(1.4); // 1.4 + 2 = 3.4, rounds to 3, floor(3) === floor(3)
			expect(callback).not.toHaveBeenCalled();

			// Change that affects integer part
			emit1(2.6); // 2.6 + 2 = 4.6, rounds to 5, floor(5) !== floor(3)
			expect(callback).toHaveBeenCalledWith(5);
		});
	});

	describe("integration tests", () => {
		it("should work with multiple dynamics and transformations", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<number>();

			const dynamic1 = t.state(10, event1);
			const dynamic2 = t.state(20, event2);

			const sumDynamic = t.computed(() => dynamic1.read() + dynamic2.read());
			const [doubledSum, _dispose] = sumDynamic.on((value) => value * 2);

			expect(doubledSum.read()).toBe(60); // (10 + 20) * 2

			emit1(15);

			expect(doubledSum.read()).toBe(70); // (15 + 20) * 2

			emit2(25);

			expect(doubledSum.read()).toBe(80); // (15 + 25) * 2
		});

		it("should maintain proper timeline context", () => {
			const [event, _emit] = t.source<number>();
			const dynamic = t.state(5, event);

			// The dynamic should work within the timeline context
			expect(() => dynamic.read()).not.toThrow();
			expect(() => dynamic.updated).not.toThrow();
			expect(() => dynamic.on((x) => x)).not.toThrow();
		});
	});
});
