import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import { Behavior } from "./Behavior";

export class State<T> extends Behavior<T> {
	public value: T;

	constructor(
		public timeline: Timeline,
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
		const maybeValue = this.updated.takeEmittedValue();
		if (!maybeValue) return { value: this.value, isUpdated: false };

		return { value: maybeValue(), isUpdated: true };
	}

	commit(): void {
		this.value = this.readNextValue().value;
	}
}
