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

		const _dispose = parent.listen<T>({
			to: this as Event<T>,
			propagate: (value) => {
				return {
					event: this,
					value: fn(value),
				};
			},
		});
	}
}
