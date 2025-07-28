import assert from "assert";
import { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import type { Behavior } from "./Behavior";

export class DerivedBehavior<T> implements Behavior<T> {
	dependencies: Set<Behavior<any>> = new Set();
	updated: Event<T>;

	lastUpdate?: { at: number; value: T };

	constructor(
		public timeline: Timeline,
		private fn: () => T,
	) {
		this.updated = new UpdatedEvent(this.timeline);
	}

	read(): T {
		if (this.lastUpdate?.at === this.timeline.timestamp)
			return this.lastUpdate.value;

		this.timeline.reportRead(this);

		try {
			this.timeline.startTrackingReads();
			const value = this.fn();

			this.lastUpdate = { at: this.timeline.timestamp, value };
			return value;
		} finally {
			this.dependencies = this.timeline.stopTrackingReads();
		}
	}
}

export class UpdatedEvent<T> extends Event<T> {
	takeEmittedValue(): (() => T) | undefined {
		assert.fail();
	}

	cleanUpLastEmittedValue(): void {}
}
