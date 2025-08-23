import { assert } from "../../utils/assert";
import { just } from "../../utils/Maybe";
import { Event } from "../event/Event";
import { ReadMode, type Timeline } from "../Timeline";
import { Dynamic } from "./Dynamic";

export class ComputedDynamic<T> extends Dynamic<T> {
	updated: Event<T> = new UpdatedEvent(this);

	lastRead?: { value: T; at: number; dependencies?: Dynamic<unknown>[] };
	nextUpdate?: {
		value: T;
		isUpdated: boolean;
		dependencies: Dynamic<unknown>[];
	};

	constructor(
		public timeline: Timeline,
		public fn: () => Generator<Dynamic<any>, T, unknown>,
		public equal: (x: T, y: T) => boolean = (x, y) => Object.is(x, y),
	) {
		super(timeline);
		this.updated = new UpdatedEvent(this);
	}

	readCurrent = (): T => {
		assert(
			this.timeline.readMode === ReadMode.Current,
			"Timeline is reading next value",
		);

		return this.computeCurrent().value;
	};

	computeCurrent = (): { value: T; dependencies?: Dynamic<unknown>[] } => {
		const { lastRead, timeline, isActive } = this;

		if (lastRead?.at === timeline.timestamp) {
			if (isActive && !lastRead.dependencies) {
				const [, dependencies] = this.timeline.pullWithTracking<T>(this.fn);

				return { value: lastRead.value, dependencies };
			}
			return lastRead;
		}

		if (isActive) {
			const [value, dependencies] = this.timeline.pullWithTracking<T>(this.fn);

			this.lastRead = { value, at: timeline.timestamp };

			return { value, dependencies };
		} else {
			const value = this.timeline.pull<T>(this.fn);
			this.lastRead = { value, at: timeline.timestamp };

			return { value };
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
		const [value, dependencies] = this.timeline.pullWithTracking(this.fn);

		const nextUpdate = {
			value,
			isUpdated: !this.equal(value, currentValue),
			dependencies,
		};

		this.nextUpdate = nextUpdate;

		return nextUpdate;
	};

	*incomings() {
		const dependencies = this.lastRead?.dependencies;
		if (!dependencies) return;

		yield* dependencies;
	}

	*outgoings() {
		yield this.updated;
		yield* this.dependedDynamics;
	}

	updateDependencies(newDependencies: Dynamic<unknown>[]) {
		this.safeEstablishEdge(() => {
			assert(this.lastRead, "lastRead is not set");

			this.lastRead.dependencies = newDependencies;
			for (const dependency of newDependencies) {
				dependency.dependedDynamics.add(this as ComputedDynamic<unknown>);

				this.timeline.topo.reorder(dependency, this);
			}
		}, newDependencies);
	}

	*proceed() {
		const currentValue = this.timeline.withReadMode(
			ReadMode.Current,
			this.readCurrent,
		);
		const [value, dependencies] = this.timeline.withReadMode(
			ReadMode.Next,
			() => this.timeline.pullWithTracking(this.fn),
		);

		const nextUpdate = {
			value,
			isUpdated: !this.equal(value, currentValue),
			dependencies,
		};
		this.nextUpdate = nextUpdate;

		yield this.updated;
		yield* this.dependedDynamics;
	}

	commit(nextTimestamp: number) {
		assert(this.nextUpdate, "nextUpdate is not set");

		const { value, isUpdated, dependencies } = this.nextUpdate;
		this.nextUpdate = undefined;

		this.updateDependencies(dependencies);

		if (!isUpdated) return;

		this.lastRead = {
			value,
			at: nextTimestamp,
			dependencies,
		};
	}

	activate() {
		const { dependencies } = this.computeCurrent();
		// biome-ignore lint/style/noNonNullAssertion: `isActive` is true, so
		this.updateDependencies(dependencies!);

		this.timeline.reorder(this, this.updated);
	}

	deactivate() {
		const { lastRead } = this;
		if (!lastRead) return;

		const { dependencies } = lastRead;
		if (!dependencies) return;

		for (const dependency of dependencies) {
			dependency.dependedDynamics.delete(this as ComputedDynamic<unknown>);
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

	*incomings() {
		yield this.computed;
	}

	activate(): void {
		this.computed.activate();
	}

	deactivate(): void {
		this.computed.deactivate();
	}

	getTag(): string | undefined {
		return this._tag ?? `UpdatedEvent(${this.computed.getTag()})`;
	}
}
