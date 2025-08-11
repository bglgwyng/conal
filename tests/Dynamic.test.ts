import { beforeEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "../src/core/Timeline";
import { Dynamic } from "../src/Dynamic";
import { Event } from "../src/Event";
import { build, computed, source, state } from "../src/factory";

describe("Dynamic", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
	});

	describe("constructor", () => {
		it("should create a Dynamic instance with internal dynamic", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(10, event);

				expect(dynamic).toBeInstanceOf(Dynamic);
				expect(dynamic.internal).toBeDefined();
			});
		});
	});

	describe("updated()", () => {
		it("should return an Event instance", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(10, event);

				expect(dynamic.updated).toBeInstanceOf(Event);
			});
		});

		it("should emit when the dynamic value changes", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(10, event);

				const callback = vi.fn();
				dynamic.updated.on(callback);

				emit(20);
				timeline.proceed();

				expect(callback).toHaveBeenCalledWith(20);
			});
		});

		it("should emit multiple times for multiple updates", () => {
			build(timeline, () => {
				const [event, emit] = source<string>();
				const dynamic = state("initial", event);

				const callback = vi.fn();
				dynamic.updated.on(callback);

				emit("first");
				timeline.proceed();
				emit("second");
				timeline.proceed();
				emit("third");
				timeline.proceed();

				expect(callback).toHaveBeenCalledTimes(3);
				expect(callback).toHaveBeenNthCalledWith(1, "first");
				expect(callback).toHaveBeenNthCalledWith(2, "second");
				expect(callback).toHaveBeenNthCalledWith(3, "third");
			});
		});
	});

	describe("read()", () => {
		it("should return the current value of the dynamic", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(42, event);

				const value = dynamic.read();

				expect(value).toBe(42);
			});
		});

		it("should return updated value after state change", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(10, event);

				expect(dynamic.read()).toBe(10);

				emit(25);
				timeline.proceed();

				expect(dynamic.read()).toBe(25);
			});
		});

		it("should work with computed dynamics", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const baseDynamic = state(5, event);
				const computedDynamic = computed(() => baseDynamic.read() * 2);

				expect(computedDynamic.read()).toBe(10);

				emit(7);
				timeline.proceed();

				expect(computedDynamic.read()).toBe(14);
			});
		});

		it("should handle complex object values", () => {
			interface Person {
				name: string;
				age: number;
			}

			build(timeline, () => {
				const [event, emit] = source<Person>();
				const dynamic = state({ name: "Alice", age: 30 }, event);

				const person = dynamic.read();

				expect(person).toEqual({ name: "Alice", age: 30 });

				emit({ name: "Bob", age: 25 });
				timeline.proceed();

				const updatedPerson = dynamic.read();
				expect(updatedPerson).toEqual({ name: "Bob", age: 25 });
			});
		});
	});

	describe("on()", () => {
		it("should return a new dynamic and dispose function", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(10, event);

				const [newDynamic, dispose] = dynamic.on((value) => value * 2);

				expect(newDynamic).toBeInstanceOf(Dynamic);
				expect(typeof dispose).toBe("function");
			});
		});

		it("should create a dynamic with transformed initial value", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(5, event);

				const [doubledDynamic, dispose] = dynamic.on((value) => value * 2);

				expect(doubledDynamic.read()).toBe(10);
			});
		});

		it("should update the new dynamic when original dynamic changes", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(3, event);

				const [squaredDynamic, dispose] = dynamic.on((value) => value * value);

				expect(squaredDynamic.read()).toBe(9);

				emit(4);
				timeline.proceed();

				expect(squaredDynamic.read()).toBe(16);

				emit(5);
				timeline.proceed();

				expect(squaredDynamic.read()).toBe(25);
			});
		});

		it("should support chaining transformations", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(2, event);

				const [doubled, dispose1] = dynamic.on((value) => value * 2);
				const [plusTen, dispose2] = doubled.on((value) => value + 10);

				expect(plusTen.read()).toBe(14); // (2 * 2) + 10

				emit(3);
				timeline.proceed();

				expect(plusTen.read()).toBe(16); // (3 * 2) + 10
			});
		});

		it("should work with different transformation types", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(42, event);

				const [stringDynamic, dispose1] = dynamic.on(
					(value) => `Number: ${value}`,
				);
				const [booleanDynamic, dispose2] = dynamic.on((value) => value > 50);

				expect(stringDynamic.read()).toBe("Number: 42");
				expect(booleanDynamic.read()).toBe(false);

				emit(75);
				timeline.proceed();

				expect(stringDynamic.read()).toBe("Number: 75");
				expect(booleanDynamic.read()).toBe(true);
			});
		});

		it("should handle complex object transformations", () => {
			interface Person {
				name: string;
				age: number;
			}

			build(timeline, () => {
				const [event, emit] = source<Person>();
				const dynamic = state({ name: "Alice", age: 30 }, event);

				const [nameDynamic, dispose1] = dynamic.on((person) => person.name);
				const [isAdultDynamic, dispose2] = dynamic.on(
					(person) => person.age >= 18,
				);

				expect(nameDynamic.read()).toBe("Alice");
				expect(isAdultDynamic.read()).toBe(true);

				emit({ name: "Charlie", age: 16 });
				timeline.proceed();

				expect(nameDynamic.read()).toBe("Charlie");
				expect(isAdultDynamic.read()).toBe(false);
			});
		});

		it("should allow dispose function to clean up subscriptions", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(1, event);

				const [transformedDynamic, dispose] = dynamic.on((value) => value * 10);

				expect(transformedDynamic.read()).toBe(10);

				// Dispose the subscription
				dispose();

				// The transformed dynamic should still have its last value
				expect(transformedDynamic.read()).toBe(10);

				// But it shouldn't update when the original dynamic changes
				emit(5);
				timeline.proceed();

				// The transformed dynamic should not have updated
				expect(transformedDynamic.read()).toBe(10);
			});
		});

		it("should handle transformation errors gracefully", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(1, event);

				const [errorDynamic, dispose] = dynamic.on((value) => {
					if (value === 42) throw new Error("Test error");
					return value * 2;
				});

				expect(errorDynamic.read()).toBe(2);

				// This should not crash
				emit(42);

				// Other values should still work
				emit(5);
				timeline.proceed();
				expect(errorDynamic.read()).toBe(10);
			});
		});

		it("should work with computed dynamics", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const baseDynamic = state(3, event);
				const computedDynamic = computed(() => baseDynamic.read() + 1);

				const [doubledComputed, dispose] = computedDynamic.on(
					(value) => value * 2,
				);

				expect(doubledComputed.read()).toBe(8); // (3 + 1) * 2

				emit(4);
				timeline.proceed();

				expect(doubledComputed.read()).toBe(10); // (4 + 1) * 2
			});
		});
	});

	describe("integration tests", () => {
		it("should work with multiple dynamics and transformations", () => {
			build(timeline, () => {
				const [event1, emit1] = source<number>();
				const [event2, emit2] = source<number>();

				const dynamic1 = state(10, event1);
				const dynamic2 = state(20, event2);

				const sumDynamic = computed(() => dynamic1.read() + dynamic2.read());
				const [doubledSum, dispose] = sumDynamic.on((value) => value * 2);

				expect(doubledSum.read()).toBe(60); // (10 + 20) * 2

				emit1(15);
				timeline.proceed();

				expect(doubledSum.read()).toBe(70); // (15 + 20) * 2

				emit2(25);
				timeline.proceed();

				expect(doubledSum.read()).toBe(80); // (15 + 25) * 2
			});
		});

		it("should maintain proper timeline context", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const dynamic = state(5, event);

				// The dynamic should work within the timeline context
				expect(() => dynamic.read()).not.toThrow();
				expect(() => dynamic.updated).not.toThrow();
				expect(() => dynamic.on((x) => x)).not.toThrow();
			});
		});
	});
});
