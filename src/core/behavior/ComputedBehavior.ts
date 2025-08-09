import type { Timeline } from "../../Timeline";
import { assert } from "../../utils/assert";
import type { Event } from "../event/Event";
import { UpdateEvent } from "../event/UpdateEvent";
import { Behavior } from "./Behavior";

export class ComputedBehavior<T> extends Behavior<T> {
	updated: Event<T> = new UpdateEvent(this);

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
		this.updated = new UpdateEvent(this);
	}

	readCurrentValue(): T {
		assert(!this.timeline.isReadingNextValue, "Timeline is reading next value");
		const { lastRead, timeline, isActive } = this;

		if (lastRead?.at === timeline.timestamp) {
			if (isActive && !lastRead.dependencies) {
				const [value, dependencies] = this.timeline.withTrackingRead(this.fn);
				assert(value === lastRead.value, "Value should be the same");

				this.updateDependencies(dependencies);
			}
			return lastRead.value;
		}

		if (isActive) {
			const [value, dependencies] = this.timeline.withTrackingRead(this.fn);

			this.lastRead = { value, at: timeline.timestamp };
			this.updateDependencies(dependencies);

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

		const currentValue = this.readCurrentValue();
		const nextUpdate = this.timeline.withReadingNextValue(() => {
			const [value, dependencies] = this.timeline.withTrackingRead(this.fn);

			return {
				value,
				isUpdated: value !== currentValue,
				dependencies,
			};
		});

		this.nextUpdate = nextUpdate;
		this.timeline.needCommit(this);

		return nextUpdate;
	}

	updateDependencies(newDependencies: Set<Behavior<any>>) {
		assert(this.lastRead, "lastRead is not set");

		for (const dependency of newDependencies) {
			dependency.dependedBehaviors.add(this);
		}
		this.lastRead.dependencies = newDependencies;
	}

	get dependencies(): Set<Behavior<any>> | undefined {
		return this.lastRead?.dependencies;
	}

	commit(nextTimestamp: number) {
		assert(this.nextUpdate);

		const { value, isUpdated, dependencies } = this.nextUpdate;
		this.nextUpdate = undefined;

		if (!isUpdated) return;

		this.lastRead = {
			value,
			at: nextTimestamp,
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
