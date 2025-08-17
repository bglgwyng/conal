import { just, type Maybe } from "../../utils/Maybe";
import type { Timeline } from "../Timeline";
import { DerivedEvent } from "./DerivedEvent";
import type { Event } from "./Event";

export class MergedEvent<L, R> extends DerivedEvent<These<L, R>> {
	constructor(
		timeline: Timeline,
		public readonly left: Event<L>,
		public readonly right: Event<R>,
	) {
		super(timeline);
	}

	deriveEmission() {
		const { left, right } = this;
		const maybeLeft = left.safeGetEmission(this);
		const maybeRight = right.safeGetEmission(this);

		return maybeLeft && maybeRight
			? just({
					type: "both" as const,
					left: maybeLeft(),
					right: maybeRight(),
				})
			: maybeLeft
				? just({ type: "left" as const, value: maybeLeft() })
				: maybeRight
					? just({ type: "right" as const, value: maybeRight() })
					: undefined;
	}

	incomings() {
		return [this.left, this.right];
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
