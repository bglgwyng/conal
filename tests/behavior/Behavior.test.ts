import { beforeEach, describe, expect, it } from "vitest";
import { Timeline } from "../../src/Timeline";

describe("Behavior.on", () => {
	let timeline: Timeline;

	beforeEach(() => {
		timeline = new Timeline();
	});

	it("should return dispose function and transformed state", () => {
		const source = timeline.source<number>();
		const state = timeline.state(0, source);

		// Transform number to string
		const [dispose, transformedState] = state.on(
			(value: number) => `value: ${value}`,
		);

		expect(typeof dispose).toBe("function");
		expect(transformedState.read()).toBe("value: 0");
	});

	it("should create state that updates when source behavior updates", () => {
		const source = timeline.source<number>();
		const state = timeline.state(5, source);

		// Transform number by doubling it
		const [dispose, doubledState] = state.on((value: number) => value * 2);

		expect(doubledState.read()).toBe(10); // 5 * 2

		timeline.start();

		// Update source and check if transformed state updates
		source.emit(7);
		timeline.flush();

		expect(doubledState.read()).toBe(14); // 7 * 2

		dispose();
	});

	it("should apply transformation function to current value", () => {
		const source = timeline.source<string>();
		const state = timeline.state("hello", source);

		// Transform string to uppercase
		const [dispose, upperState] = state.on((value: string) =>
			value.toUpperCase(),
		);

		expect(upperState.read()).toBe("HELLO");

		timeline.start();

		source.emit("world");
		timeline.flush();

		expect(upperState.read()).toBe("WORLD");

		dispose();
	});

	it("should dispose properly and stop updates", () => {
		const source = timeline.source<number>();
		const state = timeline.state(1, source);

		const [dispose, transformedState] = state.on(
			(value: number) => value + 100,
		);

		expect(transformedState.read()).toBe(101);

		timeline.start();

		// Update before disposing
		source.emit(2);
		timeline.flush();
		expect(transformedState.read()).toBe(102);

		// Dispose the subscription
		dispose();

		// Update after disposing - the transformed state should not update
		source.emit(3);
		timeline.flush();

		// The transformed state should still have the last value before disposal
		expect(transformedState.read()).toBe(102);
	});

	it("should handle complex transformations", () => {
		const source = timeline.source<{ x: number; y: number }>();
		const state = timeline.state({ x: 1, y: 2 }, source);

		// Transform object to calculate distance from origin
		const [dispose, distanceState] = state.on((point) =>
			Math.sqrt(point.x * point.x + point.y * point.y),
		);

		expect(distanceState.read()).toBeCloseTo(Math.sqrt(5), 5); // sqrt(1^2 + 2^2)

		timeline.start();

		source.emit({ x: 3, y: 4 });
		timeline.flush();

		expect(distanceState.read()).toBe(5); // sqrt(3^2 + 4^2) = 5

		dispose();
	});

	it("should work with multiple transformations on same behavior", () => {
		const source = timeline.source<number>();
		const state = timeline.state(10, source);

		const [dispose1, doubledState] = state.on((value: number) => value * 2);
		const [dispose2, stringState] = state.on(
			(value: number) => `Number: ${value}`,
		);
		const [dispose3, negatedState] = state.on((value: number) => -value);

		expect(doubledState.read()).toBe(20);
		expect(stringState.read()).toBe("Number: 10");
		expect(negatedState.read()).toBe(-10);

		timeline.start();

		source.emit(5);
		timeline.flush();

		expect(doubledState.read()).toBe(10);
		expect(stringState.read()).toBe("Number: 5");
		expect(negatedState.read()).toBe(-5);

		// Dispose all
		dispose1();
		dispose2();
		dispose3();
	});

	it("should maintain referential integrity of returned state", () => {
		const source = timeline.source<number>();
		const state = timeline.state(42, source);

		const [dispose1, transformedState1] = state.on((value: number) =>
			value.toString(),
		);
		const [dispose2, transformedState2] = state.on((value: number) =>
			value.toString(),
		);

		// Different calls should return different state instances
		expect(transformedState1).not.toBe(transformedState2);

		// But they should have the same value
		expect(transformedState1.read()).toBe(transformedState2.read());
		expect(transformedState1.read()).toBe("42");

		dispose1();
		dispose2();
	});
});
