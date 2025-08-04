import type { Behavior as InternalBehavior } from "./core/behavior/Behavior";
import { Event } from "./Event";
import { withTimeline } from "./globalContext";

export class Behavior<T> {
	// @internal
	internal: InternalBehavior<T>;

	constructor(internalBehavior: InternalBehavior<T>) {
		this.internal = internalBehavior;
	}

	updated = (): Event<T> => new Event(this.internal.updated);

	read = (): T => withTimeline(this.internal.timeline, this.internal.read);

	on<U>(fn: (value: T) => U): readonly [Behavior<U>, () => void] {
		const [effectEvent, dispose] = this.internal.on((value) =>
			withTimeline(this.internal.timeline, () => fn(value)),
		);

		return [new Behavior(effectEvent), dispose];
	}
}
