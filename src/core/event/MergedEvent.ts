import { just, type Maybe } from "../../utils/Maybe";
import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class MergedEvent<L, R> extends Event<These<L, R>> {
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: it's actually used
	private maybeEmittedValue: Maybe<Maybe<These<L, R>>>;

	constructor(
		timeline: Timeline,
		public readonly left: Event<L>,
		public readonly right: Event<R>,
	) {
		super(timeline);
	}

	getEmission() {
		const { maybeEmittedValue } = this;
		if (maybeEmittedValue) return maybeEmittedValue();

		const { left, right } = this;
		const maybeLeft = left.getEmission();
		const maybeRight = right.getEmission();

		let result: Maybe<These<L, R>>;

		if (maybeLeft && maybeRight) {
			result = just({
				type: "both" as const,
				left: maybeLeft(),
				right: maybeRight(),
			});
		} else if (maybeLeft) {
			result = just({ type: "left" as const, value: maybeLeft() });
		} else if (maybeRight) {
			result = just({ type: "right" as const, value: maybeRight() });
		}

		this.maybeEmittedValue = just(result);
		this.timeline.needCommit(this);

		return result;
	}

	commit(): void {
		this.maybeEmittedValue = undefined;
	}

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
