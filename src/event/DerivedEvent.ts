import type { Timeline } from "../Timeline";
import { Causality, Event } from "./Event";

export class DerivedEvent<T, U> extends Event<T> {
	constructor(
		timeline: Timeline,
		private parent: Event<U>,
		private fn: (value: U) => T,
		_options?: { debugLabel?: string },
	) {
		super(timeline);

		const _dispose = parent.relate(this);
	}

	takeEmittedValue() {
		const emittedValueFn = this.parent.takeEmittedValue();
		if (!emittedValueFn) return;

		try {
			const value = this.fn(emittedValueFn());
			return () => value;
		} catch (error) {
			if (error === Discard) return;

			throw error;
		}
	}
}

export const Discard = Symbol("Discard");
