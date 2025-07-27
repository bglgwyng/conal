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

		const _dispose = parent.relate<T>({
			causality: Causality.Only,
			to: this as Event<T>,
			propagate: (value) => {
				try {
					const transformedValue = fn(value);

					return () => transformedValue;
				} catch (error) {
					if (error === Discard) return;

					throw error;
				}
			},
		});
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

	cleanUpLastEmittedValue() {}
}

export const Discard = Symbol("Discard");
