import assert from "assert";
import type { Timeline } from "../Timeline";
import { Causality, type DeferredEmittingEvent, Event } from "./Event";

export class MergedEvent<L, R>
	extends Event<These<L, R>>
	implements DeferredEmittingEvent<These<L, R>>
{
	private instantContext?: These<L, R>;

	constructor(
		timeline: Timeline,
		left: Event<L>,
		right: Event<R>,
		options?: { debugLabel?: string },
	) {
		super(timeline, options);

		const _disposeLeft = left.relate({
			causality: Causality.OneOfMany,
			to: this,
			propagate: this.addLeft,
		});

		const _disposeRight = right.relate({
			causality: Causality.OneOfMany,
			to: this,
			propagate: this.addRight,
		});
	}

	public takeEmittedValue = (): These<L, R> => {
		const { instantContext } = this;
		this.instantContext = undefined;

		// biome-ignore lint/style/noNonNullAssertion: take only when `intanceContext` exists
		return instantContext!;
	};

	private addLeft = (value: L) => {
		if (this.instantContext) {
			assert(this.instantContext.type === "right");
			this.instantContext = {
				type: "both",
				left: value,
				right: this.instantContext.value,
			};
		} else {
			this.instantContext = {
				type: "left",
				value,
			};
		}
	};

	private addRight = (value: R) => {
		if (this.instantContext) {
			assert(this.instantContext.type === "left");
			this.instantContext = {
				type: "both",
				left: this.instantContext.value,
				right: value,
			};
		} else {
			this.instantContext = {
				type: "right",
				value,
			};
		}
	};
}

export const Discard = Symbol("Discard");

export type These<L, R> =
	| {
			type: "both";
			left: L;
			right: R;
	  }
	| {
			type: "left";
			value: L;
	  }
	| {
			type: "right";
			value: R;
	  };
