import { Event } from "./Event";

export class Source<T> extends Event<T> {
	private instantContext?: { value: T };

	emit(value: T) {
		const { timeline } = this;
		if (this.instantContext) {
			// TODO: warn
			this.timeline.flush();
		}
		this.instantContext = { value };

		timeline.markEmitting(this as Source<unknown>);
	}

	takeEmittedValue() {
		const { instantContext } = this;
		if (!instantContext) return;

		return () => instantContext.value;
	}

	commit() {
		this.instantContext = undefined;
	}
}
