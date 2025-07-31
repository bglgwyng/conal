import assert from "assert";
import type { Timeline } from "../Timeline";
import { just, type Maybe } from "../utils/Maybe";
import { Event } from "./Event";

export class DerivedEvent<T, U> extends Event<T> {
	private maybeEmittedValue: Maybe<T>;

	constructor(
		timeline: Timeline,
		public readonly parent: Event<U>,
		public readonly fn: (value: U) => T,
		options?: { debugLabel?: string },
	) {
		super(timeline, options);
	}

	getEmittedValue() {
		const { maybeEmittedValue } = this;
		if (maybeEmittedValue) return maybeEmittedValue;

		const maybeParentEmittedValue = this.parent.getEmittedValue();
		if (!maybeParentEmittedValue) return;

		try {
			const maybeValue = just(this.fn(maybeParentEmittedValue()));
			this.maybeEmittedValue = maybeValue;

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
