import assert from "assert";
import type { Event } from "../event/Event";
import { UpdateEvent } from "../event/UpdateEvent";
import type { Timeline } from "../Timeline";
import { Behavior } from "./Behavior";

export class DerivedBehavior<T> extends Behavior<T> {
	dependencies: Set<Behavior<any>> = new Set();
	updated: Event<T>;

	lastRead?: { value: T; at: number };
	nextUpdate?: { value: T; isUpdated: boolean };

	constructor(
		public timeline: Timeline,
		private fn: () => T,
	) {
		super(timeline);
		this.updated = new UpdateEvent(this, { debugLabel: "derived" });
	}

	readCurrentValue(): T {
		const { lastRead, timeline } = this;
		if (lastRead?.at === timeline.timestamp) return lastRead.value;

		const value = this.withTrackingReads(this.fn);
		this.lastRead = { value, at: timeline.timestamp };

		return value;
	}

	readNextValue() {
		if (this.nextUpdate) return this.nextUpdate;

		const stopReadingNextValue = this.timeline.startReadingNextValue();
		const value = this.withTrackingReads(this.fn);
		stopReadingNextValue();

		this.nextUpdate = { value, isUpdated: value !== this.readCurrentValue() };
		this.timeline.needCommit(this);

		return this.nextUpdate;
	}

	private withTrackingReads<T>(fn: () => T) {
		const stopTrackingReads = this.timeline.startTrackingReads();
		try {
			return fn();
			// TODO: handle exception
		} finally {
			const dependencies = stopTrackingReads();
			this.dependencies = dependencies;

			for (const dependency of dependencies) {
				dependency.dependedBehaviors.add(this);
			}
		}
	}

	commit() {
		assert(this.nextUpdate);

		const { value, isUpdated } = this.nextUpdate;
		this.nextUpdate = undefined;

		if (!isUpdated) return;

		this.lastRead = { value, at: this.timeline.nextTimestamp };
	}
}
