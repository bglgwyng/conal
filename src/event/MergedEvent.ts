import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class MergedEvent<L, R> extends Event<These<L, R>> {
	constructor(
		timeline: Timeline,
		private left: Event<L>,
		private right: Event<R>,
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

	protected activate(): void {
		this.disposeLeft = this.listen(this.left);
		this.disposeRight = this.listen(this.right);
	}

	protected deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `disposeLeft` is set in activate
		this.disposeLeft!();
		// biome-ignore lint/style/noNonNullAssertion: `disposeRight` is set in activate
		this.disposeRight!();
	}

	private disposeLeft?: () => void;
	private disposeRight?: () => void;
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
