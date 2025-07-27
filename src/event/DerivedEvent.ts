import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class DerivedEvent<T, U> extends Event<T> {
	constructor(
		timeline: Timeline,
		parent: Event<U>,
		fn: (value: U) => T,
		_options?: { debugLabel?: string },
	) {
		super(timeline);

		const _dispose = parent.relate<T>({
			to: this as Event<T>,
			propagate: (value) => {
				try {
					const transformedValue = fn(value);

					return {
						type: "emit",
						value: transformedValue,
					};
				} catch (error) {
					if (error === Discard) return;

					throw error;
				}
			},
		});
	}
}

export const Discard = Symbol("Discard");
