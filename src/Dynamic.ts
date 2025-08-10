import type { Dynamic as InternalDynamic } from "./core/dynamic/Dynamic";
import { Event } from "./Event";
import { withTimeline } from "./globalContext";

export class Dynamic<T> {
	// @internal
	internal: InternalDynamic<T>;
	updated: Event<T>;

	constructor(internalDynamic: InternalDynamic<T>) {
		this.internal = internalDynamic;
		this.updated = new Event(internalDynamic.updated);
	}

	read = (): T => this.internal.timeline.read(this.internal);

	on<U>(fn: (value: T) => U): readonly [Dynamic<U>, () => void] {
		const [effectEvent, dispose] = this.internal.on((value) =>
			withTimeline(this.internal.timeline, () => fn(value)),
		);

		return [new Dynamic(effectEvent), dispose];
	}

	// @internal
	tag(tag: string): Dynamic<T> {
		this.internal.tag(tag);
		return this;
	}
}
