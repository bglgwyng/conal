import { beforeEach, describe, expect, it, vi } from "vitest";
import { Behavior } from "../src/Behavior";
import { Event } from "../src/Event";
import { build, source, state } from "../src/factory";
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
	});
});
