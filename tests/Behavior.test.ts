import { beforeEach, describe, expect, it, vi } from "vitest";
import { Behavior } from "../src/Behavior";
import { Event } from "../src/Event";
import { Timeline } from "../src/Timeline";
import { build, computed, source, state } from "../src/factory";

describe("Behavior", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	describe("constructor", () => {
		it("should create a Behavior instance with internal behavior", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(10, event);

				expect(behavior).toBeInstanceOf(Behavior);
				expect(behavior.internal).toBeDefined();
			});
		});
	});

	describe("updated()", () => {
		it("should return an Event instance", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(10, event);

				const updatedEvent = behavior.updated();

				expect(updatedEvent).toBeInstanceOf(Event);
			});
		});

		it("should emit when the behavior value changes", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(10, event);
				const updatedEvent = behavior.updated();

				const callback = vi.fn();
				updatedEvent.on(callback);

				emit(20);
				timeline.proceed();

				expect(callback).toHaveBeenCalledWith(20);
			});
		});

		it("should emit multiple times for multiple updates", () => {
			build(timeline, () => {
				const [event, emit] = source<string>();
				const behavior = state("initial", event);
				const updatedEvent = behavior.updated();

				const callback = vi.fn();
				updatedEvent.on(callback);

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
		it("should return the current value of the behavior", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(42, event);

				const value = behavior.read();

				expect(value).toBe(42);
			});
		});

		it("should return updated value after state change", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(10, event);

				expect(behavior.read()).toBe(10);

				emit(25);
				timeline.proceed();

				expect(behavior.read()).toBe(25);
			});
		});

		it("should work with computed behaviors", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const baseBehavior = state(5, event);
				const computedBehavior = computed(() => baseBehavior.read() * 2);

				expect(computedBehavior.read()).toBe(10);

				emit(7);
				timeline.proceed();

				expect(computedBehavior.read()).toBe(14);
			});
		});

		it("should handle complex object values", () => {
			interface Person {
				name: string;
				age: number;
			}

			build(timeline, () => {
				const [event, emit] = source<Person>();
				const behavior = state({ name: "Alice", age: 30 }, event);

				const person = behavior.read();

				expect(person).toEqual({ name: "Alice", age: 30 });

				emit({ name: "Bob", age: 25 });
				timeline.proceed();

				const updatedPerson = behavior.read();
				expect(updatedPerson).toEqual({ name: "Bob", age: 25 });
			});
		});
	});

	describe("on()", () => {
		it("should return a new behavior and dispose function", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(10, event);

				const [newBehavior, dispose] = behavior.on((value) => value * 2);

				expect(newBehavior).toBeInstanceOf(Behavior);
				expect(typeof dispose).toBe("function");
			});
		});

		it("should create a behavior with transformed initial value", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(5, event);

				const [doubledBehavior, dispose] = behavior.on((value) => value * 2);

				expect(doubledBehavior.read()).toBe(10);
			});
		});

		it("should update the new behavior when original behavior changes", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(3, event);

				const [squaredBehavior, dispose] = behavior.on((value) => value * value);

				expect(squaredBehavior.read()).toBe(9);

				emit(4);
				timeline.proceed();

				expect(squaredBehavior.read()).toBe(16);

				emit(5);
				timeline.proceed();

				expect(squaredBehavior.read()).toBe(25);
			});
		});

		it("should support chaining transformations", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(2, event);

				const [doubled, dispose1] = behavior.on((value) => value * 2);
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
				const behavior = state(42, event);

				const [stringBehavior, dispose1] = behavior.on((value) => `Number: ${value}`);
				const [booleanBehavior, dispose2] = behavior.on((value) => value > 50);

				expect(stringBehavior.read()).toBe("Number: 42");
				expect(booleanBehavior.read()).toBe(false);

				emit(75);
				timeline.proceed();

				expect(stringBehavior.read()).toBe("Number: 75");
				expect(booleanBehavior.read()).toBe(true);
			});
		});

		it("should handle complex object transformations", () => {
			interface Person {
				name: string;
				age: number;
			}

			build(timeline, () => {
				const [event, emit] = source<Person>();
				const behavior = state({ name: "Alice", age: 30 }, event);

				const [nameBehavior, dispose1] = behavior.on((person) => person.name);
				const [isAdultBehavior, dispose2] = behavior.on((person) => person.age >= 18);

				expect(nameBehavior.read()).toBe("Alice");
				expect(isAdultBehavior.read()).toBe(true);

				emit({ name: "Charlie", age: 16 });
				timeline.proceed();

				expect(nameBehavior.read()).toBe("Charlie");
				expect(isAdultBehavior.read()).toBe(false);
			});
		});

		it("should allow dispose function to clean up subscriptions", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(1, event);

				const [transformedBehavior, dispose] = behavior.on((value) => value * 10);

				expect(transformedBehavior.read()).toBe(10);

				// Dispose the subscription
				dispose();

				// The transformed behavior should still have its last value
				expect(transformedBehavior.read()).toBe(10);

				// But it shouldn't update when the original behavior changes
				emit(5);
				timeline.proceed();

				// The transformed behavior should not have updated
				expect(transformedBehavior.read()).toBe(10);
			});
		});

		it("should handle transformation errors gracefully", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const behavior = state(1, event);

				const [errorBehavior, dispose] = behavior.on((value) => {
					if (value === 42) throw new Error("Test error");
					return value * 2;
				});

				expect(errorBehavior.read()).toBe(2);

				// This should not crash
				emit(42);

				// Other values should still work
				emit(5);
				timeline.proceed();
				expect(errorBehavior.read()).toBe(10);
			});
		});

		it("should work with computed behaviors", () => {
			build(timeline, () => {
				const [event, emit] = source<number>();
				const baseBehavior = state(3, event);
				const computedBehavior = computed(() => baseBehavior.read() + 1);

				const [doubledComputed, dispose] = computedBehavior.on((value) => value * 2);

				expect(doubledComputed.read()).toBe(8); // (3 + 1) * 2

				emit(4);
				timeline.proceed();

				expect(doubledComputed.read()).toBe(10); // (4 + 1) * 2
			});
		});
	});

	describe("integration tests", () => {
		it("should work with multiple behaviors and transformations", () => {
			build(timeline, () => {
				const [event1, emit1] = source<number>();
				const [event2, emit2] = source<number>();

				const behavior1 = state(10, event1);
				const behavior2 = state(20, event2);

				const sumBehavior = computed(() => behavior1.read() + behavior2.read());
				const [doubledSum, dispose] = sumBehavior.on((value) => value * 2);

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
				const behavior = state(5, event);

				// The behavior should work within the timeline context
				expect(() => behavior.read()).not.toThrow();
				expect(() => behavior.updated()).not.toThrow();
				expect(() => behavior.on((x) => x)).not.toThrow();
			});
		});
	});
});
