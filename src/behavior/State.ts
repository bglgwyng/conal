import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import type { Behavior } from "./Behavior";

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
