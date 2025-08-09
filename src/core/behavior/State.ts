import type { Timeline } from "../../Timeline";
import { just, type Maybe } from "../../utils/Maybe";
import type { Event } from "../event/Event";
import { Behavior } from "./Behavior";

export class State<T> extends Behavior<T> {
	public value: T;
	public maybeNextValue: Maybe<T>;

	constructor(
		timeline: Timeline,
		initialValue: T,
		public updated: Event<T>,
	) {
		super(timeline);

		this.value = initialValue;
		this.updated.writeOn(this);
	}

	readCurrentValue(): T {
		return this.value;
	}

	readNextValue(): { value: T; isUpdated: boolean } {
		const maybeValue = this.updated.getEmission();
		if (!maybeValue) return { value: this.value, isUpdated: false };

		const value = maybeValue();
		this.maybeNextValue = just(value);

		return { value, isUpdated: true };
	}

	prepareUpdate() {
		this.maybeNextValue = this.updated.getEmission();
		this.timeline.needCommit(this);
	}

	commit(): void {
		const { maybeNextValue } = this;
		if (!maybeNextValue) return;

		this.value = maybeNextValue();
		this.maybeNextValue = undefined;
	}
}
