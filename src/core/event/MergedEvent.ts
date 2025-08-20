import { just, type Maybe } from "../../utils/Maybe";
import type { Timeline } from "../Timeline";
import { DerivedEvent } from "./DerivedEvent";
import type { Event } from "./Event";

export class MergedEvent<L, R> extends DerivedEvent<These<L, R>> {
	#leftEmission: Maybe<L>;
	#rightEmission: Maybe<R>;

	constructor(
		timeline: Timeline,
		public readonly left: Event<L>,
		public readonly right: Event<R>,
	) {
		super(timeline);
	}

	deriveEmission() {
		const leftEmission = this.#leftEmission;
		const rightEmission = this.#rightEmission;

		return leftEmission && rightEmission
			? just({
					type: "both" as const,
					left: leftEmission(),
					right: rightEmission(),
				})
			: leftEmission
				? just({ type: "left" as const, value: leftEmission() })
				: rightEmission
					? just({ type: "right" as const, value: rightEmission() })
					: undefined;
	}

	incomings() {
		return [this.left, this.right];
	}

	activate(): void {
		this.safeEstablishEdge(() => {
			this.disposeLeft = this.listen(this.left, (value) => {
				this.#leftEmission = just(value);
			});
			this.disposeRight = this.listen(this.right, (value) => {
				this.#rightEmission = just(value);
			});
		}, [this.left, this.right]);
	}

	commit(_nextTimestamp: number): void {
		super.commit(_nextTimestamp);

		this.#leftEmission = undefined;
		this.#rightEmission = undefined;
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
