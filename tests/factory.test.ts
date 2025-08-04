import { beforeEach, describe, expect, it, vi } from "vitest";
import { Behavior } from "../src/Behavior";
import { Event } from "../src/Event";
import { build, computed, source, state, transform } from "../src/factory";
import { getActiveTimeline } from "../src/GlobalContext";
import { Timeline } from "../src/Timeline";

describe("Factory Functions", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	describe("source()", () => {
		it("should return [Event, emit] tuple", () => {
			const result = build(timeline, () => source<number>());

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
			const [event, emit] = result;
			expect(event).toBeInstanceOf(Event);
			expect(typeof emit).toBe("function");
		});

		it("should emit values through the emit function", () => {
			const [event, emit] = build(timeline, () => source<number>());
			const callback = vi.fn();

			event.on(callback);

			emit(42);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith(42);
		});

		it("should create different sources on single call", () => {
			const [[event1, emit1], [event2, emit2]] = build(timeline, () => {
				const source1 = source<number>();
				const source2 = source<string>();

				return [source1, source2];
			});

			expect(event1).not.toBe(event2);
			expect(emit1).not.toBe(emit2);
		});

		it("should throw when no active timeline", () => {
			expect(() => source<number>()).toThrow();
		});
	});

	describe("state()", () => {
		it("should create a Behavior with initial value", () => {
			const result = build(timeline, () => {
				const [updateEvent] = source<number>();
				return state(42, updateEvent);
			});

			expect(result).toBeInstanceOf(Behavior);
			expect(result.read()).toBe(42);
		});

		it("should update when event emits", () => {
			const [updateEvent, emit] = build(timeline, () => source<number>());
			const testState = build(timeline, () => state(0, updateEvent));

			expect(testState.read()).toBe(0);

			emit(100);
			timeline.proceed();

			expect(testState.read()).toBe(100);
		});

		it("should work with different types", () => {
			const stringState = build(timeline, () => {
				const [event] = source<string>();
				return state("hello", event);
			});

			const boolState = build(timeline, () => {
				const [event] = source<boolean>();
				return state(true, event);
			});

			expect(stringState.read()).toBe("hello");
			expect(boolState.read()).toBe(true);
		});

		it("should throw when no active timeline", () => {
			const [event] = build(timeline, () => source<number>());
			expect(() => state(42, event)).toThrow();
		});
	});

	describe("computed()", () => {
		it("should create a Behavior that computes from other behaviors", () => {
			const result = build(timeline, () => {
				const [updateEvent1, emit1] = source<number>();
				const [updateEvent2, emit2] = source<number>();
				const state1 = state(5, updateEvent1);
				const state2 = state(10, updateEvent2);
				const computedBehavior = computed(() => state1.read() + state2.read());

				return { state1, state2, computedBehavior, emit1, emit2 };
			});

			expect(result.computedBehavior).toBeInstanceOf(Behavior);
			expect(result.computedBehavior.read()).toBe(15); // 5 + 10

			// Update state1 and verify computed value updates
			result.emit1(20);
			timeline.proceed();
			expect(result.computedBehavior.read()).toBe(30); // 20 + 10

			// Update state2 and verify computed value updates
			result.emit2(5);
			timeline.proceed();
			expect(result.computedBehavior.read()).toBe(25); // 20 + 5
		});

		it("should work with constant values", () => {
			const result = build(timeline, () => {
				return computed(() => 42);
			});

			expect(result).toBeInstanceOf(Behavior);
			expect(result.read()).toBe(42);
		});

		it("should work with complex computations", () => {
			const result = build(timeline, () => {
				const [updateEvent, emit] = source<number>();
				const numberState = state(3, updateEvent);
				const computedBehavior = computed(() => {
					const value = numberState.read();
					return value * value + 1; // x^2 + 1
				});

				return { computedBehavior, emit };
			});

			expect(result.computedBehavior.read()).toBe(10); // 3^2 + 1 = 10

			// Update and verify computation
			result.emit(4);
			timeline.proceed();
			expect(result.computedBehavior.read()).toBe(17); // 4^2 + 1 = 17
		});

		it("should throw when no active timeline", () => {
			expect(() => computed(() => 42)).toThrow();
		});
	});

	describe("transform()", () => {
		it("should transform event values using the provided function", () => {
			const result = build(timeline, () => {
				const [sourceEvent, emit] = source<number>();
				const transformedEvent = transform(sourceEvent, (n) => `Number: ${n}`);
				return { transformedEvent, emit };
			});

			expect(result.transformedEvent).toBeInstanceOf(Event);

			const callback = vi.fn();
			result.transformedEvent.on(callback);

			result.emit(42);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith("Number: 42");
		});

		it("should transform different types correctly", () => {
			const result = build(timeline, () => {
				const [stringEvent, emitString] = source<string>();
				const [numberEvent, emitNumber] = source<number>();

				const stringToLength = transform(stringEvent, (s) => s.length);
				const numberToBoolean = transform(numberEvent, (n) => n > 0);

				return { stringToLength, numberToBoolean, emitString, emitNumber };
			});

			const lengthCallback = vi.fn();
			const booleanCallback = vi.fn();
			result.stringToLength.on(lengthCallback);
			result.numberToBoolean.on(booleanCallback);

			// Test string to length transformation
			result.emitString("hello");
			timeline.proceed();
			expect(lengthCallback).toHaveBeenCalledWith(5);

			// Test number to boolean transformation
			result.emitNumber(10);
			timeline.proceed();
			expect(booleanCallback).toHaveBeenCalledWith(true);

			result.emitNumber(-5);
			timeline.proceed();
			expect(booleanCallback).toHaveBeenCalledWith(false);
		});

		it("should chain transformations correctly", () => {
			const result = build(timeline, () => {
				const [sourceEvent, emit] = source<number>();
				const doubled = transform(sourceEvent, (n) => n * 2);
				const toStringEvent = transform(doubled, (n) => `Result: ${n}`);
				return { toStringEvent, emit };
			});

			const callback = vi.fn();
			result.toStringEvent.on(callback);

			result.emit(5);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith("Result: 10"); // 5 * 2 = 10
		});

		it("should work with complex objects", () => {
			interface Person {
				name: string;
				age: number;
			}

			const result = build(timeline, () => {
				const [personEvent, emit] = source<Person>();
				const nameEvent = transform(personEvent, (person) => person.name);
				const ageEvent = transform(personEvent, (person) => person.age);
				return { nameEvent, ageEvent, emit };
			});

			const nameCallback = vi.fn();
			const ageCallback = vi.fn();
			result.nameEvent.on(nameCallback);
			result.ageEvent.on(ageCallback);

			result.emit({ name: "Alice", age: 30 });
			timeline.proceed();

			expect(nameCallback).toHaveBeenCalledWith("Alice");
			expect(ageCallback).toHaveBeenCalledWith(30);
		});

		it("should throw when no active timeline", () => {
			const [event] = build(timeline, () => source<number>());
			expect(() => transform(event, (n) => n * 2)).toThrow();
		});
	});

	describe("build()", () => {
		it("should execute function with timeline context", () => {
			const result = build(timeline, () => "test result");
			expect(result).toBe("test result");
		});

		it("should allow factory functions inside build", () => {
			const result = build(timeline, () => {
				const [event, emit] = source<string>();
				const behavior = state("initial", event);
				return { event, emit, behavior };
			});

			expect(result.event).toBeInstanceOf(Event);
			expect(typeof result.emit).toBe("function");
			expect(result.behavior).toBeInstanceOf(Behavior);
			expect(result.behavior.read()).toBe("initial");
		});

		it("should handle nested builds", () => {
			const timeline2 = new Timeline();

			const result = build(timeline, () => {
				const [outer] = source<number>();

				const inner = build(timeline2, () => {
					const [inner] = source<string>();
					return inner;
				});

				return { outer, inner };
			});

			expect(result.outer).toBeInstanceOf(Event);
			expect(result.inner).toBeInstanceOf(Event);
		});

		it("should return disposable when called with only timeline", () => {
			expect(getActiveTimeline).toThrow("Timeline is not active");
			{
				using disposable = build(timeline);
				expect(getActiveTimeline()).toBe(timeline);

				expect(disposable).toBeDefined();
				expect(typeof disposable).toBe("object");
				expect(typeof disposable[Symbol.dispose]).toBe("function");
			}
			expect(getActiveTimeline).toThrow("Timeline is not active");
		});
	});
});
