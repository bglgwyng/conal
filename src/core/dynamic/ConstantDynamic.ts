import type { Timeline } from "../../Timeline";
import type { Event } from "../event/Event";
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

	readCurrentValue(): T {
		return this.value;
	}

	readNextValue() {
		return { value: this.value, isUpdated: false };
	}
}
