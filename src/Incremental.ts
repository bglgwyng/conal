import { State } from "./core/dynamic/State";
import { TransformedEvent } from "./core/event/TransformedEvent";
import { Dynamic } from "./Dynamic";
import type { Event } from "./Event";
import type { Timeline } from "./Timeline";

export class Incremental<T, D> extends Dynamic<T> {
	// @internal

	constructor(
		timeline: Timeline,
		initialValue: T,
		readonly transition: Event<readonly [T, D]>,
	) {
		const internal = new State(
			timeline.internal,
			initialValue,
			new TransformedEvent(
				timeline.internal,
				transition.internal,
				([value, _]) => value,
			),
		);
		super(timeline, internal);
	}
}
