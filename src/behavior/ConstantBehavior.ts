import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import { Behavior } from "./Behavior";

export class ConstantBehavior<T> extends Behavior<T> {
	public updated: Event<T>;
	constructor(
		public timeline: Timeline,
		private value: T,
	) {
		super(timeline);

		this.updated = this.timeline.never;
	}

	readCurrentValue(): T {
		return this.value;
	}

	readNextValue() {
		return { value: this.value, isUpdated: false };
	}
}
