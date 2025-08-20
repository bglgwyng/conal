import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import { Dynamic } from "./Dynamic";

export class ConstantDynamic<T> extends Dynamic<T> {
	public updated: Event<T>;
	constructor(
		public timeline: Timeline,
		public readonly value: T,
	) {
		super(timeline);

		this.updated = this.timeline.never;
	}

	readCurrent(): T {
		return this.value;
	}

	incomings() {
		return [];
	}

	commit(_nextTimestamp: number): void {}
}
