import { State } from "./core/dynamic/State";
import { TransformedEvent } from "./core/event/TransformedEvent";
import type { Timeline } from "./core/Timeline";
import { Dynamic } from "./Dynamic";
import type { Event } from "./Event";

export class Incremental<T, D> extends Dynamic<T> {
	// @internal

	constructor(
		timeline: Timeline,
		initialValue: T,
		readonly transition: Event<readonly [T, D]>,
	) {
		const internal = new State(
			timeline,
			initialValue,
			new TransformedEvent(
				timeline,
				transition.internalEvent,
				([value, _]) => value,
			),
		);
		super(internal);
	}

	// @internal
	tag(tag: string): Dynamic<T> {
		this.internal.tag(tag);
		return this;
	}
}
