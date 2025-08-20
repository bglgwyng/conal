import { beforeEach, describe, expect, it, vi } from "vitest";
import { Source } from "../../../src/core/event/Source";
import { Timeline } from "../../../src/core/Timeline";

describe("Event isActive dynamic", () => {
	let timeline: Timeline;
	let source: Source<number>;

	beforeEach(() => {
		timeline = new Timeline({ onSourceEmission() {} });
		source = new Source<number>(timeline);
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
			// biome-ignore lint/suspicious/noExplicitAny: `activate` and `deactivate` are protected
			const activateSpy = vi.spyOn(source as any, "activate");
			// biome-ignore lint/suspicious/noExplicitAny: `activate` and `deactivate` are protected
			const deactivateSpy = vi.spyOn(source as any, "deactivate");

			const [, dispose] = source.on(() => {});
			expect(activateSpy).toHaveBeenCalledTimes(1);

			dispose();
			expect(deactivateSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("combined conditions", () => {
		it("should handle rapid activation/deactivation cycles", () => {
			// biome-ignore lint/suspicious/noExplicitAny: `activate` and `deactivate` are protected
			const activateSpy = vi.spyOn(source as any, "activate");
			// biome-ignore lint/suspicious/noExplicitAny: `activate` and `deactivate` are protected
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
			expect(dispose).not.toThrow();
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
