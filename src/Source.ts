import { Event } from "./Event";

export class Source<T> extends Event<T> {
	instantContext?: {
		value: T;
	};

	emit(value: T) {
		if (this.instantContext) {
			// TODO: warn
			this.timeline.flush();
		}
		this.instantContext = { value };

		this.timeline.markEmitting(this as Source<unknown>);
	}
}
