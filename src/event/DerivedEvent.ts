import assert from "assert";
import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class DerivedEvent<T, U> extends Event<T> {
	constructor(
		timeline: Timeline,
		private parent: Event<U>,
		private fn: (value: U) => T,
		options?: { debugLabel?: string },
	) {
		super(timeline, options);
	}

	takeEmittedValue() {
		const maybeEmittedValue = this.parent.takeEmittedValue();
		if (!maybeEmittedValue) return;

		try {
			const value = this.fn(maybeEmittedValue());
			return () => value;
		} catch (error) {
			if (error === Discard) return;

			throw error;
		}
	}

	protected activate() {
		assert(this.isActive, "Event is not active");
		console.info("Activate!!", this.debugLabel);
		this.dispose = this.listen(this.parent);
	}

	protected deactivate() {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.dispose!();
		this.dispose = undefined;
	}

	private dispose?: () => void;
}

export const Discard = Symbol("Discard");
