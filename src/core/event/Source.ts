import assert from "assert";
import { just, type Maybe } from "../../utils/Maybe";
import { Event } from "./Event";

export class Source<T> extends Event<T> {
	maybeLastEmitedValue: Maybe<T>;

	emit(value: T) {
		const { timeline } = this;
		assert(timeline.hasStarted, "Timeline has not started");
		assert(!timeline.isProceeding, "Timeline is proceeding");

		if (this.maybeLastEmitedValue) {
			// TODO: warn
			timeline.proceed();
		}
		this.maybeLastEmitedValue = just(value);

		timeline.markEmitting(this as Source<unknown>);
		timeline.needCommit(this);
	}

	getEmittedValue() {
		return this.maybeLastEmitedValue;
	}

	commit() {
		this.maybeLastEmitedValue = undefined;
	}
}
