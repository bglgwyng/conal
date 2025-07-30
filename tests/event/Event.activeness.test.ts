import { beforeEach, describe, expect, it, vi } from "vitest";
import { State } from "../../src/behavior/State";
import { Source } from "../../src/event/Source";
import { Timeline } from "../../src/Timeline";

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

			const [dispose] = source.on(() => {});

			expect(source.isActive).toBe(true);

			dispose();
			expect(source.isActive).toBe(false);
		});

		it("should remain active with multiple effects", () => {
			const [dispose1] = source.on(() => {});
			const [dispose2] = source.on(() => {});

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

			const [dispose] = source.on(() => {});
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

	describe("child events (listen method)", () => {
		it("should become active when another event listens to it", () => {
			const childSource = new Source<string>(timeline);

			expect(source.isActive).toBe(false);

			// Make childSource active first (required for listen)
			const [childDispose] = childSource.on(() => {});

			// Now childSource can listen to source
			const dispose = childSource.listen(source);

			expect(source.isActive).toBe(true);
			expect(source.childEvents.has(childSource)).toBe(true);

			dispose();
			expect(source.isActive).toBe(false);
			expect(source.childEvents.has(childSource)).toBe(false);

			childDispose();
		});

		it("should remain active with multiple child events", () => {
			const child1 = new Source<string>(timeline);
			const child2 = new Source<string>(timeline);

			// Make children active
			const [child1Effect] = child1.on(() => {});
			const [child2Effect] = child2.on(() => {});

			// Children listen to source
			const dispose1 = child1.listen(source);
			const dispose2 = child2.listen(source);

			expect(source.isActive).toBe(true);
			expect(source.childEvents.size).toBe(2);

			// Remove one child, should still be active
			dispose1();
			expect(source.isActive).toBe(true);
			expect(source.childEvents.size).toBe(1);

			// Remove last child, should become inactive
			dispose2();
			expect(source.isActive).toBe(false);
			expect(source.childEvents.size).toBe(0);

			child1Effect();
			child2Effect();
		});

		it("should not allow inactive event to listen, but work when event becomes active", () => {
			const childSource = new Source<string>(timeline);

			// Child is inactive initially
			expect(childSource.isActive).toBe(false);
			expect(source.isActive).toBe(false);

			// Inactive child tries to listen - this should fail with assertion
			expect(() => childSource.listen(source)).toThrow("Event is not active");

			// Source should still be inactive
			expect(source.isActive).toBe(false);
			expect(source.childEvents.size).toBe(0);

			// Now make child active first
			const [childEffect] = childSource.on(() => {});
			expect(childSource.isActive).toBe(true);

			// Now child can listen to source
			const dispose = childSource.listen(source);

			// Source should now be active because it has a child event
			expect(source.isActive).toBe(true);
			expect(source.childEvents.has(childSource)).toBe(true);

			// Clean up
			dispose();
			expect(source.isActive).toBe(false);
			expect(source.childEvents.has(childSource)).toBe(false);

			childEffect();
		});
	});

	describe("combined conditions", () => {
		it("should remain active when multiple conditions are met", () => {
			const childSource = new Source<string>(timeline);

			// Add effect
			const [effectDispose] = source.on(() => {});
			expect(source.isActive).toBe(true);

			// Add state dependency
			const stateDispose = source.writeOn(state);
			expect(source.isActive).toBe(true);

			// Add child event
			const [childEffect] = childSource.on(() => {});
			const childDispose = childSource.listen(source);
			expect(source.isActive).toBe(true);

			// Remove effect, should still be active (state + child)
			effectDispose();
			expect(source.isActive).toBe(true);

			// Remove state, should still be active (child)
			stateDispose();
			expect(source.isActive).toBe(true);

			// Remove child, should become inactive
			childDispose();
			expect(source.isActive).toBe(false);

			childEffect();
		});

		it("should handle rapid activation/deactivation cycles", () => {
			const activateSpy = vi.spyOn(source as any, "activate");
			const deactivateSpy = vi.spyOn(source as any, "deactivate");

			// Multiple rapid activations
			for (let i = 0; i < 5; i++) {
				const [dispose] = source.on(() => {});
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
			const [dispose] = source.on(callback);

			expect(source.isActive).toBe(true);

			// Remove the effect twice
			dispose();
			expect(source.isActive).toBe(false);

			// Should not throw or cause issues
			expect(() => dispose()).not.toThrow();
			expect(source.isActive).toBe(false);
		});

		it("should maintain correct state when effects are added and removed in different orders", () => {
			const [dispose1] = source.on(() => {});
			const [dispose2] = source.on(() => {});
			const [dispose3] = source.on(() => {});

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
