import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dynamic } from "../src/Dynamic";
import { Event } from "../src/Event";
import {
	build,
	computed,
	source,
	state,
	switchable,
	transform,
} from "../src/factory";
import { Timeline } from "../src/Timeline";

describe("Factory Functions", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
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
		it("should create a Dynamic with initial value", () => {
			const result = build(timeline, () => {
				const [updateEvent] = source<number>();
				return state(42, updateEvent);
			});

			expect(result).toBeInstanceOf(Dynamic);
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
		it("should create a Dynamic that computes from other dynamics", () => {
			const result = build(timeline, () => {
				const [updateEvent1, emit1] = source<number>();
				const [updateEvent2, emit2] = source<number>();
				const state1 = state(5, updateEvent1);
				const state2 = state(10, updateEvent2);
				const computedDynamic = computed(() => state1.read() + state2.read());

				return { state1, state2, computedDynamic, emit1, emit2 };
			});

			expect(result.computedDynamic).toBeInstanceOf(Dynamic);
			expect(result.computedDynamic.read()).toBe(15); // 5 + 10

			// Update state1 and verify computed value updates
			result.emit1(20);
			timeline.proceed();
			expect(result.computedDynamic.read()).toBe(30); // 20 + 10

			// Update state2 and verify computed value updates
			result.emit2(5);
			timeline.proceed();
			expect(result.computedDynamic.read()).toBe(25); // 20 + 5
		});

		it("should work with constant values", () => {
			const result = build(timeline, () => {
				return computed(() => 42);
			});

			expect(result).toBeInstanceOf(Dynamic);
			expect(result.read()).toBe(42);
		});

		it("should work with complex computations", () => {
			const result = build(timeline, () => {
				const [updateEvent, emit] = source<number>();
				const numberState = state(3, updateEvent);
				const computedDynamic = computed(() => {
					const value = numberState.read();
					return value * value + 1; // x^2 + 1
				});

				return { computedDynamic, emit };
			});

			expect(result.computedDynamic.read()).toBe(10); // 3^2 + 1 = 10

			// Update and verify computation
			result.emit(4);
			timeline.proceed();
			expect(result.computedDynamic.read()).toBe(17); // 4^2 + 1 = 17
		});

		it("should throw when no active timeline", () => {
			expect(() => computed(() => 42)).toThrow();
		});
	});

	describe("transform()", () => {
		it("should transform event values using the provided function", () => {
			const result = build(timeline, () => {
				const [sourceEvent, emit] = source<number>();
				const transformedEvent = transform((n) => `Number: ${n}`, sourceEvent);
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

				const stringToLength = transform((s) => s.length, stringEvent);
				const numberToBoolean = transform((n) => n > 0, numberEvent);

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
				const doubled = transform((n) => n * 2, sourceEvent);
				const toStringEvent = transform((n) => `Result: ${n}`, doubled);
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
				const nameEvent = transform((person) => person.name, personEvent);
				const ageEvent = transform((person) => person.age, personEvent);
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
			expect(() => transform((n) => n * 2, event)).toThrow();
		});
	});

	describe("switchable()", () => {
		it("should create an Event that switches between events based on dynamic", () => {
			const result = build(timeline, () => {
				const [event1, emit1] = source<string>();
				const [event2, emit2] = source<string>();
				const [switchEvent, emitSwitch] = source<Event<string>>();

				const switchDynamic = state(event1, switchEvent);
				const switchableEvent = switchable(switchDynamic);

				return { switchableEvent, emit1, emit2, emitSwitch, event1, event2 };
			});

			expect(result.switchableEvent).toBeInstanceOf(Event);

			const callback = vi.fn();
			result.switchableEvent.on(callback);

			// Initially should listen to event1
			result.emit1("from event1");
			timeline.proceed();
			expect(callback).toHaveBeenCalledWith("from event1");

			// Switch to event2
			result.emitSwitch(result.event2);
			timeline.proceed();

			// Now should listen to event2
			result.emit2("from event2");
			timeline.proceed();
			expect(callback).toHaveBeenCalledWith("from event2");

			// event1 should no longer trigger the callback
			callback.mockClear();
			result.emit1("should not trigger");
			timeline.proceed();
			expect(callback).not.toHaveBeenCalled();
		});

		it("should work with different event types", () => {
			const result = build(timeline, () => {
				const [numberEvent, emitNumber] = source<number>();
				const [stringEvent, emitString] = source<string>();
				const [switchEvent, emitSwitch] = source<Event<any>>();

				const switchDynamic = state<Event<any>>(numberEvent, switchEvent);
				const switchableEvent = switchable(switchDynamic);

				return {
					switchableEvent,
					emitNumber,
					emitString,
					emitSwitch,
					numberEvent,
					stringEvent,
				};
			});

			const callback = vi.fn();
			result.switchableEvent.on(callback);

			// Start with number event
			result.emitNumber(42);
			timeline.proceed();
			expect(callback).toHaveBeenCalledWith(42);

			// Switch to string event
			result.emitSwitch(result.stringEvent);
			timeline.proceed();

			result.emitString("hello");
			timeline.proceed();
			expect(callback).toHaveBeenCalledWith("hello");
		});

		it("should handle multiple switches correctly", () => {
			const result = build(timeline, () => {
				const [event1, emit1] = source<string>();
				const [event2, emit2] = source<string>();
				const [event3, emit3] = source<string>();
				const [switchEvent, emitSwitch] = source<Event<string>>();

				const switchDynamic = state(event1, switchEvent);
				const switchableEvent = switchable(switchDynamic);

				return {
					switchableEvent,
					emit1,
					emit2,
					emit3,
					emitSwitch,
					event1,
					event2,
					event3,
				};
			});

			const callback = vi.fn();
			result.switchableEvent.on(callback);

			// Test switching between multiple events
			result.emit1("first");
			timeline.proceed();
			expect(callback).toHaveBeenLastCalledWith("first");

			result.emitSwitch(result.event2);
			timeline.proceed();
			result.emit2("second");
			timeline.proceed();
			expect(callback).toHaveBeenLastCalledWith("second");

			result.emitSwitch(result.event3);
			timeline.proceed();
			result.emit3("third");
			timeline.proceed();
			expect(callback).toHaveBeenLastCalledWith("third");

			// Switch back to event1
			result.emitSwitch(result.event1);
			timeline.proceed();
			result.emit1("back to first");
			timeline.proceed();
			expect(callback).toHaveBeenLastCalledWith("back to first");
		});

		it("should work with computed dynamics 2", () => {
			build(timeline);
			const [event1, emit1] = source<number>();
			const [event2, emit2] = source<number>();
			const [toggleEvent, emitToggle] = source<boolean>();

			const toggleDynamic = state(true, toggleEvent);
			const eventDynamic = computed(() =>
				toggleDynamic.read() ? event1 : event2,
			);
			const switchableEvent = switchable(eventDynamic);

			const callback = vi.fn();
			switchableEvent.on(callback);

			// Initially should use event1 (toggle is true)
			emit1(100);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith(100);

			// Switch to event2 by toggling
			emitToggle(false);
			timeline.proceed();

			emit2(200);
			timeline.proceed();

			expect(callback).toHaveBeenCalledWith(200);

			// // event1 should no longer work
			callback.mockClear();
			emit1(300);
			timeline.proceed();
			expect(callback).not.toHaveBeenCalled();
		});

		it("should handle immediate emission from current event", () => {
			build(timeline);
			const [event1, emit1] = source<string>();
			const [event2, emit2] = source<string>();
			const [switchEvent, emitSwitch] = source<Event<string>>();

			// Emit to event1 before creating switchable
			emit1("initial value");

			const switchDynamic = state(event1, switchEvent);
			const switchableEvent = switchable(switchDynamic);

			const callback = vi.fn();
			switchableEvent.on(callback);

			// Should get the value that was already emitted
			timeline.proceed();
			expect(callback).toHaveBeenCalledWith("initial value");
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
				const dynamic = state("initial", event);
				return { event, emit, dynamic };
			});

			expect(result.event).toBeInstanceOf(Event);
			expect(typeof result.emit).toBe("function");
			expect(result.dynamic).toBeInstanceOf(Dynamic);
			expect(result.dynamic.read()).toBe("initial");
		});

		it("should handle nested builds", () => {
			const timeline2 = new Timeline({ onSourceEmission() {} });

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
	});
});
