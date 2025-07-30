import { just, type Maybe } from "../utils/Maybe";
import { Event } from "./Event";

export class Source<T> extends Event<T> {
	maybeLastEmitedValue: Maybe<T>;

	emit(value: T) {
		const { timeline } = this;
		if (this.maybeLastEmitedValue) {
			// TODO: warn
			this.timeline.flush();
		}
		this.maybeLastEmitedValue = just(value);

		timeline.markEmitting(this as Source<unknown>);
		this.timeline.needCommit(this);
	}

	takeEmittedValue() {
		const { maybeLastEmitedValue } = this;
		if (!maybeLastEmitedValue) return;

		return maybeLastEmitedValue;
	}

	commit() {
		this.maybeLastEmitedValue = undefined;
	}
}
