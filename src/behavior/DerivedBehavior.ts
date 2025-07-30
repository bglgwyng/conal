import assert from "assert";
import type { Event } from "../event/Event";
import { UpdateEvent } from "../event/UpdateEvent";
import type { Timeline } from "../Timeline";
import { Behavior } from "./Behavior";

export class DerivedBehavior<T> extends Behavior<T> {
	updated: Event<T>;

	lastRead?: { value: T; at: number; dependencies: Set<Behavior<any>> };
	nextUpdate?: {
		value: T;
		isUpdated: boolean;
		dependencies: Set<Behavior<any>>;
	};

	constructor(
		public timeline: Timeline,
		public fn: () => T,
	) {
		super(timeline);
		this.updated = new UpdateEvent(this, { debugLabel: "derived" });
	}

	readCurrentValue(): T {
		const { lastRead, timeline } = this;
		if (lastRead?.at === timeline.timestamp) return lastRead.value;

		const [value, dependencies] = this.withTrackingReads(this.fn);
		this.lastRead = { value, at: timeline.timestamp, dependencies };

		for (const dependency of dependencies) {
			dependency.dependedBehaviors.add(this);
		}

		return value;
	}

	readNextValue() {
		assert(this.timeline.isProceeding);

		if (this.nextUpdate) return this.nextUpdate;

		const stopReadingNextValue = this.timeline.startReadingNextValue();
		try {
			const [value, dependencies] = this.withTrackingReads(this.fn);

			this.nextUpdate = {
				value,
				isUpdated: value !== this.readCurrentValue(),
				dependencies,
			};

			this.timeline.needCommit(this);
		} finally {
			stopReadingNextValue();
		}

		return this.nextUpdate;
	}

	get dependencies(): Set<Behavior<any>> | undefined {
		return this.lastRead?.dependencies;
	}

	private withTrackingReads<U>(
		fn: () => U,
	): readonly [value: U, dependencies: Set<Behavior<any>>] {
		const stopTrackingReads = this.timeline.startTrackingReads();
		try {
			const value = fn();
			const dependencies = stopTrackingReads();
			return [value, dependencies] as const;
		} catch (error) {
			// Clean up tracking on error
			stopTrackingReads();
			throw error;
		}
	}

	commit() {
		assert(this.nextUpdate);

		const { value, isUpdated, dependencies } = this.nextUpdate;
		this.nextUpdate = undefined;

		if (!isUpdated) return;

		this.lastRead = {
			value,
			at: this.timeline.nextTimestamp,
			dependencies,
		};
	}
}
