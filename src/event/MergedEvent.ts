import type { Timeline } from "../Timeline";
import { just } from "../utils/Maybe";
import { Event } from "./Event";

export class MergedEvent<L, R> extends Event<These<L, R>> {
	constructor(
		timeline: Timeline,
		public readonly left: Event<L>,
		public readonly right: Event<R>,
		options?: { debugLabel?: string },
	) {
		super(timeline, options);
	}

	// TODO: cache
	public takeEmittedValue = () => {
		const { left, right } = this;
		const maybeLeft = left.takeEmittedValue();
		const maybeRight = right.takeEmittedValue();

		if (maybeLeft && maybeRight)
			return just({
				type: "both" as const,
				left: maybeLeft(),
				right: maybeRight(),
			});
		if (maybeLeft) return just({ type: "left" as const, value: maybeLeft() });
		if (maybeRight)
			return just({ type: "right" as const, value: maybeRight() });

		return;
	};

	activate(): void {
		this.disposeLeft = this.listen(this.left);
		this.disposeRight = this.listen(this.right);
	}

	deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `disposeLeft` is set in activate
		this.disposeLeft!();
		this.disposeLeft = undefined;
		// biome-ignore lint/style/noNonNullAssertion: `disposeRight` is set in activate
		this.disposeRight!();
		this.disposeRight = undefined;
	}

	disposeLeft?: () => void;
	disposeRight?: () => void;
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
