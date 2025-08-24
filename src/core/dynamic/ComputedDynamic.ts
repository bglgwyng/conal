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
		return this.computeCurrent().value;
	};

	computeCurrent = (): { value: T; dependencies?: Dynamic<unknown>[] } => {
		const { lastRead, timeline, isActive } = this;

		if (lastRead?.at === timeline.timestamp) {
			if (isActive && !lastRead.dependencies) {
				const [, dependencies] = this.pullWithTracking<T>(this.fn);

				return { value: lastRead.value, dependencies };
			}
			return lastRead;
		}

		if (isActive) {
			const [value, dependencies] = this.pullWithTracking<T>(this.fn);

			this.lastRead = { value, at: timeline.timestamp };

			return { value, dependencies };
		} else {
			const value = this.pull<T>(this.fn);
			this.lastRead = { value, at: timeline.timestamp };

			return { value };
		}
	};

	readNext = () => {
		const { timeline, isActive } = this;
		assert(timeline.isProceeding, "Timeline is not proceeding");
		assert(isActive, "ComputedDynamic is not active");
		if (this.nextUpdate) return this.nextUpdate;

		const currentValue = this.readCurrent();
		const [value, dependencies] = this.pullNext(this.fn);

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
		const currentValue = this.readCurrent();
		const [value, dependencies] = this.pullNext(this.fn);

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

	pull<T>(fn: () => Generator<Dynamic<unknown>, T>): T {
		const it = fn();
		let value: unknown;
		while (true) {
			const next = it.next(value);
			if (next.done) return next.value;

			value = next.value.readCurrent();
		}
	}

	pullNext<T>(
		fn: () => Generator<Dynamic<unknown>, T>,
	): readonly [value: T, dependencies: Dynamic<unknown>[]] {
		const reads: Dynamic<unknown>[] = [];
		const readSet = new Set<Dynamic<unknown>>();

		const it = fn();
		let value: unknown;
		while (true) {
			const next = it.next(value);
			if (next.done) return [next.value, reads];

			if (!readSet.has(next.value)) {
				reads.push(next.value);
				readSet.add(next.value);
			}

			value = next.value.readNext().value;
		}
	}

	pullWithTracking<T>(
		fn: () => Generator<Dynamic<unknown>, T>,
	): readonly [value: T, dependencies: Dynamic<unknown>[]] {
		const reads: Dynamic<unknown>[] = [];
		const readSet = new Set<Dynamic<unknown>>();

		const it = fn();
		let value: unknown;
		while (true) {
			const next = it.next(value);
			if (next.done) return [next.value, reads];

			if (!readSet.has(next.value)) {
				reads.push(next.value);
				readSet.add(next.value);
			}

			value = next.value.readCurrent();
		}
	}
}

class UpdatedEvent<T> extends Event<T> {
	constructor(public computed: ComputedDynamic<T>) {
		super(computed.timeline);
	}

	getEmission() {
		const { value, isUpdated } = this.computed.readNext();
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
