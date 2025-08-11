import { UnsafeDynamic } from "./core/dynamic/UnsafeDynamic";
import { TransformedEvent } from "./core/event/TransformedEvent";
import { Dynamic } from "./Dynamic";
import type { Event } from "./Event";
import type { Timeline } from "./Timeline";

export class UnsafeIncremental<T, D> extends Dynamic<T> {
	// @internal

	constructor(
		timeline: Timeline,
		readCurrent: () => T,
		readonly transition: Event<readonly [T, D]>,
	) {
		const internal = new UnsafeDynamic(
			timeline,
			readCurrent,
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
