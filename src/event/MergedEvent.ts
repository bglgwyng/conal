import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class MergedEvent<L, R> extends Event<These<L, R>> {
	private instantContext?: These<L, R>;

	constructor(
		timeline: Timeline,
		private left: Event<L>,
		private right: Event<R>,
		options?: { debugLabel?: string },
	) {
		super(timeline, options);

		const _disposeLeft = left.relate(this);

		const _disposeRight = right.relate(this);
	}

	public takeEmittedValue = () => {
		const { left, right } = this;
		const maybeLeft = left.takeEmittedValue();
		const maybeRight = right.takeEmittedValue();

		if (maybeLeft && maybeRight)
			return () => ({
				type: "both" as const,
				left: maybeLeft(),
				right: maybeRight(),
			});
		if (maybeLeft) return () => ({ type: "left" as const, value: maybeLeft() });
		if (maybeRight)
			return () => ({ type: "right" as const, value: maybeRight() });

		return;
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
