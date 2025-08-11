import { beforeEach, describe, expect, it, vi } from "vitest";
import { proceedImmediately } from "../src";
import { Dynamic } from "../src/Dynamic";
import { Event } from "../src/Event";
import { Timeline } from "../src/Timeline";

describe("Timeline", () => {
	let t: Timeline;

	beforeEach(() => {
		t = new Timeline({ onSourceEmission: proceedImmediately });
	});

	describe("source()", () => {
		it("should return [Event, emit] tuple", () => {
			const result = t.source<number>();

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
			const [event, emit] = result;
			expect(event).toBeInstanceOf(Event);
			expect(typeof emit).toBe("function");
		});

		it("should emit values through the emit function", () => {
			const [event, emit] = t.source<number>();
			const callback = vi.fn();

			event.on(callback);

			emit(42);

			expect(callback).toHaveBeenCalledWith(42);
		});

		it("should create different sources on single call", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<string>();

			expect(event1).not.toBe(event2);
			expect(emit1).not.toBe(emit2);
		});
	});

	describe("state()", () => {
		it("should create a Dynamic with initial value", () => {
			const result = t.state(42, t.source<number>()[0]);

			expect(result).toBeInstanceOf(Dynamic);
			expect(result.read()).toBe(42);
		});

		it("should update when event emits", () => {
			const [updateEvent, emit] = t.source<number>();
			const testState = t.state(0, updateEvent);

			expect(testState.read()).toBe(0);

			emit(100);

			expect(testState.read()).toBe(100);
		});

		it("should work with different types", () => {
			const stringState = t.state("hello", t.source<string>()[0]);

			const boolState = t.state(true, t.source<boolean>()[0]);

			expect(stringState.read()).toBe("hello");
			expect(boolState.read()).toBe(true);
		});
	});

	describe("computed()", () => {
		it("should create a Dynamic that computes from other dynamics", () => {
			const [updateEvent1, emit1] = t.source<number>();
			const [updateEvent2, emit2] = t.source<number>();
			const state1 = t.state(5, updateEvent1);
			const state2 = t.state(10, updateEvent2);
			const computedDynamic = t.computed(() => state1.read() + state2.read());

			expect(computedDynamic).toBeInstanceOf(Dynamic);
			expect(computedDynamic.read()).toBe(15); // 5 + 10

			// Update state1 and verify computed value updates
			emit1(20);
			expect(computedDynamic.read()).toBe(30); // 20 + 10

			// Update state2 and verify computed value updates
			emit2(5);
			expect(computedDynamic.read()).toBe(25); // 20 + 5
			expect(computedDynamic.read()).toBe(25); // 20 + 5
		});

		it("should work with constant values", () => {
			const result = t.computed(() => 42);

			expect(result).toBeInstanceOf(Dynamic);
			expect(result.read()).toBe(42);
		});

		it("should work with complex computations", () => {
			const [updateEvent, emit] = t.source<number>();
			const numberState = t.state(3, updateEvent);
			const computedDynamic = t.computed(() => {
				const value = numberState.read();
				return value * value + 1; // x^2 + 1
			});

			expect(computedDynamic.read()).toBe(10); // 3^2 + 1 = 10

			// Update and verify computation
			emit(4);
			expect(computedDynamic.read()).toBe(17); // 4^2 + 1 = 17
		});
	});

	describe("transform()", () => {
		it("should transform event values using the provided function", () => {
			const [sourceEvent, emit] = t.source<number>();
			const transformedEvent = sourceEvent.transform((n) => `Number: ${n}`);

			expect(transformedEvent).toBeInstanceOf(Event);

			const callback = vi.fn();
			transformedEvent.on(callback);

			emit(42);

			expect(callback).toHaveBeenCalledWith("Number: 42");
		});

		// 	it("should transform different types correctly", () => {
		// 		const result = build(timeline, () => {
		// 			const [stringEvent, emitString] = source<string>();
		// 			const [numberEvent, emitNumber] = source<number>();

		// 			const stringToLength = transform((s) => s.length, stringEvent);
		// 			const numberToBoolean = transform((n) => n > 0, numberEvent);

		// 			return { stringToLength, numberToBoolean, emitString, emitNumber };
		// 		});

		// 		const lengthCallback = vi.fn();
		// 		const booleanCallback = vi.fn();
		// 		result.stringToLength.on(lengthCallback);
		// 		result.numberToBoolean.on(booleanCallback);

		// 		// Test string to length transformation
		// 		result.emitString("hello");
		// 		timeline.proceed();
		// 		expect(lengthCallback).toHaveBeenCalledWith(5);

		// 		// Test number to boolean transformation
		// 		result.emitNumber(10);
		// 		timeline.proceed();
		// 		expect(booleanCallback).toHaveBeenCalledWith(true);

		// 		result.emitNumber(-5);
		// 		timeline.proceed();
		// 		expect(booleanCallback).toHaveBeenCalledWith(false);
		// 	});

		it("should chain transformations correctly", () => {
			const [sourceEvent, emit] = t.source<number>();
			const doubled = sourceEvent.transform((n) => n * 2);
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

			const [personEvent, emit] = t.source<Person>();
			const nameEvent = personEvent.transform((person) => person.name);
			const ageEvent = personEvent.transform((person) => person.age);

			const nameCallback = vi.fn();
			const ageCallback = vi.fn();
			nameEvent.on(nameCallback);
			ageEvent.on(ageCallback);

			emit({ name: "Alice", age: 30 });

			expect(nameCallback).toHaveBeenCalledWith("Alice");
			expect(ageCallback).toHaveBeenCalledWith(30);
		});

		describe("switching()", () => {
			it("should create an Event that switches between events based on dynamic", () => {
				const [event1, emit1] = t.source<string>();
				const [event2, emit2] = t.source<string>();
				const [switchEvent, emitSwitch] = t.source<Event<string>>();

				const switchDynamic = t.state(event1, switchEvent);
				const switchingEvent = t.switching(switchDynamic);

				expect(switchingEvent).toBeInstanceOf(Event);

				const callback = vi.fn();
				switchingEvent.on(callback);

				// Initially should listen to event1
				emit1("from event1");
				expect(callback).toHaveBeenCalledWith("from event1");

				// Switch to event2
				emitSwitch(event2);

				// Now should listen to event2
				emit2("from event2");
				expect(callback).toHaveBeenCalledWith("from event2");

				// event1 should no longer trigger the callback
				callback.mockClear();
				emit1("should not trigger");
				expect(callback).not.toHaveBeenCalled();
			});

			it("should work with different event types", () => {
				const [numberEvent, emitNumber] = t.source<number>();
				const [stringEvent, emitString] = t.source<string>();
				const [switchEvent, emitSwitch] = t.source<Event<any>>();

				const switchDynamic = t.state<Event<any>>(numberEvent, switchEvent);
				const switchingEvent = t.switching(switchDynamic);

				const callback = vi.fn();
				switchingEvent.on(callback);

				// Start with number event
				emitNumber(42);
				expect(callback).toHaveBeenCalledWith(42);

				// Switch to string event
				emitSwitch(stringEvent);

				emitString("hello");

				expect(callback).toHaveBeenCalledWith("hello");
			});

			it("should handle multiple switches correctly", () => {
				const [event1, emit1] = t.source<string>();
				const [event2, emit2] = t.source<string>();
				const [event3, emit3] = t.source<string>();
				const [switchEvent, emitSwitch] = t.source<Event<string>>();

				const switchDynamic = t.state(event1, switchEvent);
				const switchingEvent = t.switching(switchDynamic);

				const callback = vi.fn();
				switchingEvent.on(callback);

				// Test switching between multiple events
				emit1("first");

				expect(callback).toHaveBeenLastCalledWith("first");

				emitSwitch(event2);

				emit2("second");

				expect(callback).toHaveBeenLastCalledWith("second");

				emitSwitch(event3);

				emit3("third");

				expect(callback).toHaveBeenLastCalledWith("third");

				// Switch back to event1
				emitSwitch(event1);

				emit1("back to first");

				expect(callback).toHaveBeenLastCalledWith("back to first");
			});

			it("should work with computed dynamics 2", () => {
				const [event1, emit1] = t.source<number>();
				const [event2, emit2] = t.source<number>();
				const [toggleEvent, emitToggle] = t.source<boolean>();

				const toggleDynamic = t.state(true, toggleEvent);
				const eventDynamic = t.computed(() =>
					toggleDynamic.read() ? event1 : event2,
				);
				const switchingEvent = t.switching(eventDynamic);

				const callback = vi.fn();
				switchingEvent.on(callback);

				// Initially should use event1 (toggle is true)
				emit1(100);

				expect(callback).toHaveBeenCalledWith(100);

				// Switch to event2 by toggling
				emitToggle(false);

				emit2(200);

				expect(callback).toHaveBeenCalledWith(200);

				// // event1 should no longer work
				callback.mockClear();
				emit1(300);

				expect(callback).not.toHaveBeenCalled();
			});

			it("should handle immediate emission from current event", () => {
				const [event1, emit1] = t.source<string>();
				const [event2, emit2] = t.source<string>();
				const [switchEvent, emitSwitch] = t.source<Event<string>>();

				// Emit to event1 before creating switching

				const switchDynamic = t.state(event1, switchEvent);
				const switchingEvent = t.switching(switchDynamic);

				const callback = vi.fn();
				switchingEvent.on(callback);

				emit1("initial value");

				// Should get the value that was already emitted
				expect(callback).toHaveBeenCalledWith("initial value");
			});
		});
	});

	describe("merge()", () => {
		it("should create a merged event that emits from both sources", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<string>();
			const mergedEvent = t.merge(event1, event2);

			const callback = vi.fn();
			mergedEvent.on(callback);

			// Emit from first event
			emit1(42);
			expect(callback).toHaveBeenCalledWith({ type: "left", value: 42 });

			// Emit from second event
			emit2("hello");
			expect(callback).toHaveBeenCalledWith({ type: "right", value: "hello" });

			expect(callback).toHaveBeenCalledTimes(2);
		});

		it("should handle simultaneous emissions from both events", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<string>();
			const mergedEvent = t.merge(event1, event2);

			const callback = vi.fn();
			mergedEvent.on(callback);

			// Emit from both events simultaneously
			emit1(100);
			emit2("world");

			// Should receive both emissions
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, { type: "left", value: 100 });
			expect(callback).toHaveBeenNthCalledWith(2, {
				type: "right",
				value: "world",
			});
		});

		it("should work with different data types", () => {
			interface Person {
				name: string;
				age: number;
			}

			const [numberEvent, emitNumber] = t.source<number>();
			const [personEvent, emitPerson] = t.source<Person>();
			const mergedEvent = t.merge(numberEvent, personEvent);

			const callback = vi.fn();
			mergedEvent.on(callback);

			emitNumber(25);
			expect(callback).toHaveBeenCalledWith({ type: "left", value: 25 });

			emitPerson({ name: "Alice", age: 30 });
			expect(callback).toHaveBeenCalledWith({
				type: "right",
				value: { name: "Alice", age: 30 },
			});
		});

		it("should work with boolean and array types", () => {
			const [boolEvent, emitBool] = t.source<boolean>();
			const [arrayEvent, emitArray] = t.source<number[]>();
			const mergedEvent = t.merge(boolEvent, arrayEvent);

			const callback = vi.fn();
			mergedEvent.on(callback);

			emitBool(true);
			expect(callback).toHaveBeenCalledWith({ type: "left", value: true });

			emitArray([1, 2, 3]);
			expect(callback).toHaveBeenCalledWith({
				type: "right",
				value: [1, 2, 3],
			});
		});

		it("should support chaining with other event operations", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<number>();
			const mergedEvent = t.merge(event1, event2);

			// Transform the merged event
			const transformedEvent = mergedEvent.transform((merged) => {
				if (merged.type === "left") {
					return `Left: ${merged.value}`;
				} else if (merged.type === "right") {
					return `Right: ${merged.value}`;
				} else {
					// type === "both"
					return `Both: ${merged.left} and ${merged.right}`;
				}
			});

			const callback = vi.fn();
			transformedEvent.on(callback);

			emit1(10);
			expect(callback).toHaveBeenCalledWith("Left: 10");

			emit2(20);
			expect(callback).toHaveBeenCalledWith("Right: 20");
		});

		it("should work with state updates", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<number>();
			const mergedEvent = t.merge(event1, event2);

			// Create a state that updates from the merged event
			const mergedState = t.state(
				0,
				mergedEvent.transform((merged) => {
					if (merged.type === "left") {
						return merged.value;
					} else if (merged.type === "right") {
						return merged.value * 2;
					} else {
						// type === "both"
						return merged.left + merged.right;
					}
				}),
			);

			expect(mergedState.read()).toBe(0);

			// Update from left event
			emit1(5);
			expect(mergedState.read()).toBe(5);

			// Update from right event (should be doubled)
			emit2(3);
			expect(mergedState.read()).toBe(6); // 3 * 2
		});

		it("should handle multiple sequential emissions", () => {
			const [event1, emit1] = t.source<string>();
			const [event2, emit2] = t.source<string>();
			const mergedEvent = t.merge(event1, event2);

			const callback = vi.fn();
			mergedEvent.on(callback);

			// Multiple emissions in sequence
			emit1("first");
			emit2("second");
			emit1("third");
			emit2("fourth");
			emit1("fifth");

			expect(callback).toHaveBeenCalledTimes(5);
			expect(callback).toHaveBeenNthCalledWith(1, {
				type: "left",
				value: "first",
			});
			expect(callback).toHaveBeenNthCalledWith(2, {
				type: "right",
				value: "second",
			});
			expect(callback).toHaveBeenNthCalledWith(3, {
				type: "left",
				value: "third",
			});
			expect(callback).toHaveBeenNthCalledWith(4, {
				type: "right",
				value: "fourth",
			});
			expect(callback).toHaveBeenNthCalledWith(5, {
				type: "left",
				value: "fifth",
			});
		});

		it("should work with computed dynamics as event sources", () => {
			const [sourceEvent, emit] = t.source<number>();
			const numberState = t.state(0, sourceEvent);

			// Create computed dynamics that emit events
			const evenComputed = t.computed(() => numberState.read() % 2 === 0);
			const doubledComputed = t.computed(() => numberState.read() * 2);

			// Use updated events from computed dynamics
			const mergedEvent = t.merge(
				evenComputed.updated,
				doubledComputed.updated,
			);

			const callback = vi.fn();
			mergedEvent.on(callback);

			// Update the source - both computeds should emit
			emit(3);

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({
				type: "both",
				left: false,
				right: 6,
			});
		});

		it("should support nested merging", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<string>();
			const [event3, emit3] = t.source<boolean>();

			// First merge
			const merged12 = t.merge(event1, event2);

			// Second merge with the result of the first merge
			const merged123 = t.merge(merged12, event3);

			const callback = vi.fn();
			merged123.on(callback);

			emit1(42);
			expect(callback).toHaveBeenCalledWith({
				type: "left",
				value: { type: "left", value: 42 },
			});

			emit2("test");
			expect(callback).toHaveBeenCalledWith({
				type: "left",
				value: { type: "right", value: "test" },
			});

			emit3(true);
			expect(callback).toHaveBeenCalledWith({
				type: "right",
				value: true,
			});
		});

		it("should handle edge cases with null and undefined values", () => {
			const [event1, emit1] = t.source<null>();
			const [event2, emit2] = t.source<undefined>();
			const mergedEvent = t.merge(event1, event2);

			const callback = vi.fn();
			mergedEvent.on(callback);

			emit1(null);
			expect(callback).toHaveBeenCalledWith({ type: "left", value: null });

			emit2(undefined);
			expect(callback).toHaveBeenCalledWith({
				type: "right",
				value: undefined,
			});
		});

		it("should work with transformed events as inputs", () => {
			const [sourceEvent, emit] = t.source<number>();

			// Create transformed events
			const doubledEvent = sourceEvent.transform((x) => x * 2);
			const stringEvent = sourceEvent.transform((x) => `Number: ${x}`);

			const mergedEvent = t.merge(doubledEvent, stringEvent);

			const callback = vi.fn();
			mergedEvent.on(callback);

			emit(5);

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({
				type: "both",
				left: 10,
				right: "Number: 5",
			});
		});

		it("should maintain proper timeline behavior", () => {
			const [event1, emit1] = t.source<number>();
			const [event2, emit2] = t.source<number>();
			const mergedEvent = t.merge(event1, event2);

			// Verify the merged event is properly connected to the timeline
			expect(mergedEvent.timeline).toBe(t.internal);

			const callback = vi.fn();
			mergedEvent.on(callback);

			// Should work normally
			emit1(100);
			emit2(200);

			expect(callback).toHaveBeenCalledTimes(2);
		});
	});
});
