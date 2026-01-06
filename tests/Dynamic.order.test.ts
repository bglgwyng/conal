import { beforeEach, describe, expect, it, vi } from "vitest";
import { proceedImmediately } from "../src";
import { Dynamic } from "../src/Dynamic";
import { Event } from "../src/Event";
import { Timeline } from "../src/Timeline";

describe("Dynamic order", () => {
	let t: Timeline;
	let proceed: () => void;

	beforeEach(() => {
		t = new Timeline({
			onSourceEmission: (proceed$) => {
				proceed = proceed$;
			},
		});
	});

	describe("updated()", () => {
		it("pending readNext", () => {
			const [source1, emit1] = t.source<number>();
			source1.tag("source1");
			const [source2, emit2] = t.source<number>();
			source2.tag("source2");
			const [source3, emit3] = t.source<number>();
			source3.tag("source3");

			const state1 = t.state(0, source1);
			state1.tag("state1");
			const state2 = t.state(0, source2);
			state2.tag("state2");
			const state3 = t.state(0, source3);
			state3.tag("state3");

			const computed = t.computed(function* () {
				if ((yield* state2) === 0) {
					return -1;
				}
				return yield* state3;
			});
			computed.tag("computed7");
			t.internal.topo.increaseRank(state3.internal, 7);

			const eMerged = t.merge(source1, computed.updated).tag("eMerged");
			const [e] = eMerged.on((x) => {
				console.info(x);
			});
			e.tag("e");

			const [eUpdated] = computed.updated.on((x) => {
				console.info({ x });
			});
			eUpdated.tag("eUpdated");

			expect(state1.internal.rank).toBe(1);
			expect(state2.internal.rank).toBe(1);
			expect(state3.internal.rank).toBe(7);

			expect(computed.internal.rank).toBe(2);

			expect(eMerged.internal.rank).toBe(4);

			emit1(1);
			proceed();

			emit1(1);
			emit2(1);
			emit3(1);

			proceed();
		});
	});
});
