import { beforeEach, describe, expect, it, vi } from "vitest";
import { State } from "../../../src/core/behavior/State";
import { Source } from "../../../src/core/event/Source";
import { Timeline } from "../../../src/Timeline";

describe("Event isActive behavior", () => {
	let timeline: Timeline;
	let source: Source<number>;
	let state: State<number>;
	let switchEvent: Source<number>;

	beforeEach(() => {
		timeline = new Timeline();
		source = new Source<number>(timeline);
		switchEvent = new Source<number>(timeline);
		state = new State<number>(timeline, 0, switchEvent);
	});

	describe("initial state", () => {
		it("should be inactive when no effects, states, or child events", () => {
			expect(source.isActive).toBe(false);
		});
	});

	describe("effects (on method)", () => {
		it("should become active when adding an effect", () => {
			expect(source.isActive).toBe(false);

			const [, dispose] = source.on(() => {});

			expect(source.isActive).toBe(true);

			dispose();
			expect(source.isActive).toBe(false);
		});

		it("should remain active with multiple effects", () => {
			const [, dispose1] = source.on(() => {});
			const [, dispose2] = source.on(() => {});

			expect(source.isActive).toBe(true);

			// Remove one effect, should still be active
			dispose1();
			expect(source.isActive).toBe(true);

			// Remove last effect, should become inactive
			dispose2();
			expect(source.isActive).toBe(false);
		});

		it("should call activate/deactivate hooks correctly with effects", () => {
			const activateSpy = vi.spyOn(source as any, "activate");
			const deactivateSpy = vi.spyOn(source as any, "deactivate");

			const [, dispose] = source.on(() => {});
			expect(activateSpy).toHaveBeenCalledTimes(1);

			dispose();
			expect(deactivateSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("depended states (writeOn method)", () => {
		it("should become active when writing to a state", () => {
			expect(source.isActive).toBe(false);

			const dispose = source.writeOn(state);

			expect(source.isActive).toBe(true);

			dispose();
			expect(source.isActive).toBe(false);
		});

		it("should remain active with multiple depended states", () => {
			const state2 = new State<number>(timeline, 10, switchEvent);

			const dispose1 = source.writeOn(state);
			const dispose2 = source.writeOn(state2);

			expect(source.isActive).toBe(true);

			// Remove one state dependency, should still be active
			dispose1();
			expect(source.isActive).toBe(true);

			// Remove last state dependency, should become inactive
			dispose2();
			expect(source.isActive).toBe(false);
		});
	});

	describe("combined conditions", () => {
		it("should remain active when multiple conditions are met", () => {
			// Add effect
			const [, dispose] = source.on(() => {});
			expect(source.isActive).toBe(true);

			// Add state dependency
			const stateDispose = source.writeOn(state);
			expect(source.isActive).toBe(true);

			// Remove effect, should still be active
			dispose();
			expect(source.isActive).toBe(true);

			// Remove state, should be inactive
			stateDispose();
			expect(source.isActive).toBe(false);
		});

		it("should handle rapid activation/deactivation cycles", () => {
			const activateSpy = vi.spyOn(source as any, "activate");
			const deactivateSpy = vi.spyOn(source as any, "deactivate");

			// Multiple rapid activations
			for (let i = 0; i < 5; i++) {
				const [, dispose] = source.on(() => {});
				expect(source.isActive).toBe(true);
				dispose();
				expect(source.isActive).toBe(false);
			}

			expect(activateSpy).toHaveBeenCalledTimes(5);
			expect(deactivateSpy).toHaveBeenCalledTimes(5);
		});
	});

	describe("edge cases", () => {
		it("should handle removing non-existent effects gracefully", () => {
			const callback = () => {};
			const [, dispose] = source.on(callback);

			expect(source.isActive).toBe(true);

			// Remove the effect twice
			dispose();
			expect(source.isActive).toBe(false);

			// Should not throw or cause issues
			expect(() => dispose()).not.toThrow();
			expect(source.isActive).toBe(false);
		});

		it("should maintain correct state when effects are added and removed in different orders", () => {
			const [, dispose1] = source.on(() => {});
			const [, dispose2] = source.on(() => {});
			const [, dispose3] = source.on(() => {});

			expect(source.isActive).toBe(true);

			// Remove middle effect
			dispose2();
			expect(source.isActive).toBe(true);

			// Remove first effect
			dispose1();
			expect(source.isActive).toBe(true);

			// Remove last effect
			dispose3();
			expect(source.isActive).toBe(false);
		});
	});
});
