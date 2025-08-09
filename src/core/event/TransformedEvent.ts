import assert from "assert";
import type { Timeline } from "../../Timeline";
import { just, type Maybe } from "../../utils/Maybe";
import { Event } from "./Event";

export class TransformedEvent<T, U> extends Event<T> {
	private maybeEmittedValue: Maybe<Maybe<T>>;

	constructor(
		timeline: Timeline,
		public readonly parent: Event<U>,
		public readonly fn: (value: U) => T,
	) {
		super(timeline);
	}

	getEmission() {
		const { maybeEmittedValue } = this;
		if (maybeEmittedValue) return maybeEmittedValue();

		const maybeParentEmittedValue = this.parent.getEmission();
		if (!maybeParentEmittedValue) return;

		try {
			const maybeValue = just(this.fn(maybeParentEmittedValue()));
			this.maybeEmittedValue = just(maybeValue);

			this.timeline.needCommit(this);

			return maybeValue;
		} catch (error) {
			if (error === Discard) return;

			throw error;
		}
	}

	commit(): void {
		this.maybeEmittedValue = undefined;
	}

	activate() {
		assert(this.isActive, "Event is not active");
		this.dispose = this.listen(this.parent);
	}

	deactivate() {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.dispose!();
		this.dispose = undefined;
	}

	dispose?: () => void;
}

export const Discard = Symbol("Discard");
