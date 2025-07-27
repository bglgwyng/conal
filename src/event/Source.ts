import assert from "assert";
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

	takeLastEmittedValue() {
		assert(this.instantContext !== undefined, "no instant context!");
		const { value } = this.instantContext;
		this.instantContext = undefined;

		return value;
	}
}
