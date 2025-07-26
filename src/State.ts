import type { Behavior } from "./Behavior";
import type { Event } from "./Event";
import type { Timeline } from "./Timeline";

export class State<T> implements Behavior<T> {
	value: T;

	constructor(
		public timeline: Timeline,
		initialValue: T,
		public updated: Event<T>,
	) {
		this.value = initialValue;
		this.updated.dependenedStates.add(this);
	}

	read(): T {
		return this.value;
	}
}
