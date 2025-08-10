import type { Event as InternalEvent } from "./core/event/Event";
import { MergedEvent, type These } from "./core/event/MergedEvent";
import { TransformedEvent } from "./core/event/TransformedEvent";

export class Event<T> {
	// @internal
	internalEvent: InternalEvent<T>;

	constructor(internalEvent: InternalEvent<T>) {
		this.internalEvent = internalEvent;
	}

	get timeline() {
		return this.internalEvent.timeline;
	}

	get isActive() {
		return this.internalEvent.isActive;
	}

	on<U>(fn: (value: T) => U): readonly [Event<U>, () => void] {
		const [effectEvent, dispose] = this.internalEvent.on(fn);

		return [new Event(effectEvent), dispose];
	}

	mergeWith<U>(event: Event<U>): Event<These<T, U>> {
		return new Event(
			new MergedEvent(
				this.internalEvent.timeline,
				this.internalEvent,
				event.internalEvent,
			),
		);
	}

	transform<U>(fn: (value: T) => U): Event<U> {
		return new Event(
			new TransformedEvent(this.internalEvent.timeline, this.internalEvent, fn),
		);
	}

	// @internal
	tag(tag: string): Event<T> {
		this.internalEvent.tag(tag);
		return this;
	}
}
