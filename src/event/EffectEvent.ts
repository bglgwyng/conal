import { just, type Maybe } from "../utils/Maybe";
import { Event } from "./Event";

export class EffectEvent<T> extends Event<T> {
	maybeLastEmitedValue: Maybe<T>;

	emit(value: T) {
		this.maybeLastEmitedValue = just(value);

		this.timeline.needCommit(this);
	}

	getEmittedValue() {
		return this.maybeLastEmitedValue;
	}

	commit() {
		this.maybeLastEmitedValue = undefined;
	}
}
