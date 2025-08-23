import type { Dynamic as InternalDynamic } from "./core/dynamic/Dynamic";
import { Event } from "./Event";
import { withTimeline } from "./globalContext";
import type { Timeline } from "./Timeline";

export class Dynamic<T> {
	// @internal
	internal: InternalDynamic<T>;
	updated: Event<T>;

	constructor(
		readonly timeline: Timeline,
		internalDynamic: InternalDynamic<T>,
	) {
		this.internal = internalDynamic;
		this.updated = new Event(this.timeline, internalDynamic.updated);
	}

	read = (): T => this.internal.read();

	on<U>(fn: (value: T) => U): readonly [Dynamic<U>, () => void] {
		const [effectDynamic, dispose] = this.internal.on((value) => {
			return withTimeline(this.internal.timeline, () => fn(value));
		});

		return [new Dynamic(this.timeline, effectDynamic), dispose];
	}

	// @internal
	tag(tag: string): Dynamic<T> {
		this.internal.setTag(tag);
		return this;
	}

	*[Symbol.iterator](): Generator<Dynamic<T>, T, T> {
		return yield this;
	}
}
