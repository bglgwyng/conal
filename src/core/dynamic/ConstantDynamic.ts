import type { Event } from "../event/Event";
import type { Node } from "../Node";
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

	readNext(): { value: T; isUpdated: boolean } {
		return { value: this.value, isUpdated: false };
	}

	incomings() {
		return [];
	}

	outgoings() {
		return this.dependedDynamics;
	}

	*proceed(): Iterable<Node> {}

	commit(_nextTimestamp: number): void {}
}
