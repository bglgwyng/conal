import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import { Behavior } from "./Behavior";

export class State<T> extends Behavior<T> {
	private value: T;

	constructor(
		public timeline: Timeline,
		initialValue: T,
		public updated: Event<T>,
	) {
		super(timeline);

		this.value = initialValue;
		this.updated.writeOn(this);
	}

	read(): T {
		this.timeline.reportRead(this);

		return this.value;
	}
}
