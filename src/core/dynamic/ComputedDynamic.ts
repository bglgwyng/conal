import { assert } from "../../utils/assert";
import { just } from "../../utils/Maybe";
import { Event } from "../event/Event";
import { ReadMode, type Timeline } from "../Timeline";
import { Dynamic } from "./Dynamic";

export class ComputedDynamic<T> extends Dynamic<T> {
	updated: Event<T> = new UpdatedEvent(this);

	lastRead?: { value: T; at: number; dependencies?: Set<Dynamic<unknown>> };
	nextUpdate?: {
		value: T;
		isUpdated: boolean;
		dependencies: Set<Dynamic<unknown>>;
	};

	constructor(
		public timeline: Timeline,
		public fn: () => T,
	) {
		super(timeline);
		this.updated = new UpdatedEvent(this);
	}

	readCurrent = (): T => {
		assert(
			this.timeline.readMode === ReadMode.Current,
			"Timeline is reading next value",
		);
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
	};

	readNext = () => {
		const { timeline, isActive } = this;
		assert(timeline.isProceeding, "Timeline is not proceeding");
		assert(
			timeline.readMode === ReadMode.Next,
			"Timeline is not reading next value",
		);
		assert(isActive, "ComputedDynamic is not active");

		if (this.nextUpdate) return this.nextUpdate;

		const currentValue = this.timeline.withReadMode(
			ReadMode.Current,
			this.readCurrent,
		);
		const [value, dependencies] = this.timeline.withTrackingRead(this.fn);

		const nextUpdate = {
			value,
			isUpdated: value !== currentValue,
			dependencies,
		};

		this.nextUpdate = nextUpdate;
		this.timeline.needCommit(this);

		return nextUpdate;
	};

	updateDependencies(newDependencies: Set<Dynamic<any>>) {
		assert(this.lastRead, "lastRead is not set");

		for (const dependency of newDependencies) {
			dependency.dependedDynamics.add(this);
		}
		this.lastRead.dependencies = newDependencies;
	}

	get dependencies(): Set<Dynamic<any>> | undefined {
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
		this.readCurrent();
	}

	deactivate() {
		const { lastRead } = this;
		if (!lastRead) return;

		const { dependencies } = lastRead;
		if (!dependencies) return;

		for (const dependency of dependencies) {
			dependency.dependedDynamics.delete(this);
		}
		lastRead.dependencies = undefined;
	}

	get isActive() {
		return this.updated.isActive;
	}
}

class UpdatedEvent<T> extends Event<T> {
	constructor(public computed: ComputedDynamic<T>) {
		super(computed.timeline);
	}

	getEmission() {
		const { value, isUpdated } = this.timeline.withReadMode(
			ReadMode.Next,
			this.computed.readNext,
		);
		if (!isUpdated) return;

		return just(value);
	}

	activate(): void {
		this.computed.activate();
	}

	deactivate(): void {
		this.computed.deactivate();
	}
}
