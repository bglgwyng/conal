import type { Event as InternalEvent } from "./core/event/Event";
import { MergedEvent, type These } from "./core/event/MergedEvent";
import { TransformedEvent } from "./core/event/TransformedEvent";
import type { Timeline } from "./Timeline";

export class Event<T> {
	// @internal
	internal: InternalEvent<T>;

	constructor(
		readonly timeline: Timeline,
		internalEvent: InternalEvent<T>,
	) {
		this.internal = internalEvent;
	}

	get isActive() {
		return this.internal.isActive;
	}

	on<U>(fn: (value: T) => U): readonly [Event<U>, () => void] {
		const [effectEvent, dispose] = this.internal.on(fn);

		return [new Event(this.timeline, effectEvent), dispose];
	}

	mergeWith<U>(event: Event<U>): Event<These<T, U>> {
		return new Event(
			this.timeline,
			new MergedEvent(this.internal.timeline, this.internal, event.internal),
		);
	}

	transform<U>(fn: (value: T) => U): Event<U> {
		return new Event(
			this.timeline,
			new TransformedEvent(this.internal.timeline, this.internal, fn),
		);
	}

	// @internal
	tag(tag: string): this {
		this.internal.setTag(tag);
		return this;
	}
}
