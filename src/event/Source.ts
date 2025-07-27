import { Event } from "./Event";

export class Source<T> extends Event<T> {
	private instantContext?: { value: T };

	emit(value: T) {
		if (this.instantContext) {
			// TODO: warn
			this.timeline.flush();
		}
		this.instantContext = { value };

		this.timeline.markEmitting(this as Source<unknown>);
	}

	takeEmittedValue() {
		const { instantContext } = this;
		if (!instantContext) return;

		return () => instantContext.value;
	}

	cleanUpLastEmittedValue() {
		this.instantContext = undefined;
	}
}
