import assert from "assert";
import type { Timeline } from "../../Timeline";
import type { Event } from "../event/Event";
import { UpdateEvent } from "../event/UpdateEvent";
import { Behavior } from "./Behavior";

export class ComputedBehavior<T> extends Behavior<T> {
	updated: Event<T>;

	lastRead?: { value: T; at: number; dependencies?: Set<Behavior<any>> };
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

		if (this.isActive) {
			const [value, dependencies] = this.timeline.withTrackingRead(this.fn);
			this.lastRead = { value, at: timeline.timestamp, dependencies };

			for (const dependency of dependencies) {
				dependency.dependedBehaviors.add(this);
			}

			return value;
		} else {
			const value = this.fn();
			this.lastRead = { value, at: timeline.timestamp };

			return value;
		}
	}

	readNextValue() {
		assert(this.timeline.isProceeding, "Timeline is not proceeding");
		assert(this.isActive, "ComputedBehavior is not active");

		if (this.nextUpdate) return this.nextUpdate;

		const nextValue = this.timeline.withReadingNextValue(() => {
			const [value, dependencies] = this.timeline.withTrackingRead(this.fn);

			return {
				value,
				isUpdated: value !== this.readCurrentValue(),
				dependencies,
			};
		});

		this.nextUpdate = nextValue;
		this.timeline.needCommit(this);

		return nextValue;
	}

	get dependencies(): Set<Behavior<any>> | undefined {
		return this.lastRead?.dependencies;
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

	activate() {
		this.readCurrentValue();
	}

	deactivate() {
		const { lastRead } = this;
		if (!lastRead) return;

		const { dependencies } = lastRead;
		if (!dependencies) return;

		for (const dependency of dependencies) {
			dependency.dependedBehaviors.delete(this);
		}
		lastRead.dependencies = undefined;
	}

	get isActive() {
		return this.updated.isActive;
	}
}
