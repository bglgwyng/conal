import { assert, assertInternal } from "../../utils/assert";
import { just } from "../../utils/Maybe";
import { Event } from "../event/Event";
import {
	type Node,
	type ProceedEffect,
	ProceedState,
	propagate,
} from "../Node";
import type { Timeline } from "../Timeline";
import { Dynamic } from "./Dynamic";
import { pullCurrent, pullCurrentWithoutTracking, pullNext } from "./pull";

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
		public fn: () => Generator<Dynamic<unknown>, T>,
		public equal: (x: T, y: T) => boolean = (x, y) => Object.is(x, y),
	) {
		super(timeline);
		this.updated = new UpdatedEvent(this);
	}

	readCurrent = (): T => {
		const { lastRead, timeline, isActive } = this;

		if (lastRead?.at === timeline.timestamp) {
			if (isActive && !lastRead.dependencies) {
				const [value, dependencies] = pullCurrent(this.fn);
				assert(value === lastRead.value, "Value should be the same");

				this.updateDependencies(dependencies);
			}
			return lastRead.value;
		}

		if (isActive) {
			const [value, dependencies] = pullCurrent(this.fn);

			this.lastRead = { value, at: timeline.timestamp };
			this.updateDependencies(dependencies);

			return value;
		} else {
			const value = pullCurrentWithoutTracking(this.fn);
			this.lastRead = { value, at: timeline.timestamp };

			return value;
		}
	};

	readNext = (): {
		value: T;
		isUpdated: boolean;
		dependencies: Dynamic<unknown>[];
	} => {
		console.info("readNext", this.getTag(), this.proceedState);
		assertInternal(this.proceedState === ProceedState.Done);
		assertInternal(this.nextUpdate, "nextUpdate is not set");

		return this.nextUpdate;
	};

	*incomings() {
		const dependencies = this.lastRead?.dependencies;
		if (!dependencies) return;

		yield* dependencies;
	}

	*outgoings() {
		yield this.updated;
		yield* super.outgoings();
	}

	// biome-ignore lint/suspicious/noExplicitAny: to satisfy covariance
	updateDependencies(newDependencies: Dynamic<any>[]) {
		this.safeEstablishEdge(() => {
			assertInternal(this.lastRead, "lastRead is not set");

			const oldDependencies = this.lastRead.dependencies ?? [];
			const newDependencySet = new Set(newDependencies);
			for (const dependency of oldDependencies) {
				if (!newDependencySet.has(dependency)) {
					dependency.dependedDynamics.delete(this as ComputedDynamic<unknown>);
				}
			}

			this.lastRead.dependencies = newDependencies;
			for (const dependency of newDependencies) {
				if (dependency.dependedDynamics.has(this as ComputedDynamic<unknown>))
					continue;

				dependency.dependedDynamics.add(this as ComputedDynamic<unknown>);

				this.timeline.topo.reorder(dependency, this);
			}

			const firstDependency = newDependencies[0];
			if (!firstDependency) return;

			console.info("reorder!!!", firstDependency.getTag(), this.getTag());
			this.timeline.reorder(firstDependency, this);
		}, newDependencies);
	}

	// biome-ignore lint/suspicious/noExplicitAny: to satisfy covariance
	get dependencies(): Dynamic<any>[] | undefined {
		return this.lastRead?.dependencies;
	}

	*proceed(): Generator<ProceedEffect> {
		const { timeline, isActive } = this;
		assertInternal(timeline.isProceeding, "Timeline is not proceeding");
		// TODO: remove
		assertInternal(isActive, "ComputedDynamic is not active");
		// TODO: remove
		assertInternal(!this.nextUpdate, "nextUpdate is not cleared");

		const currentValue = this.readCurrent();
		// console.group(`pull next ${this.getTag()}`);
		const [value, dependencies] = yield* pullNext(this.fn);
		// console.groupEnd();

		const nextUpdate = {
			value,
			isUpdated: !this.equal(value, currentValue),
			dependencies,
		};
		this.nextUpdate = nextUpdate;

		// TODO: remove `as Node`
		yield* propagate(this.updated as Node);
		// console.info(
		// 	"##",
		// 	[...this.dependedDynamics].map((x) => x.getTag()),
		// );
		for (const dynamic of this.dependedDynamics) yield* propagate(dynamic);
	}

	commit(nextTimestamp: number) {
		assertInternal(this.nextUpdate, "nextUpdate is not set");

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
		this.readCurrent();

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
		// assert(this.computed.proceedState !== ProceedState.Pending);
		console.info("HERE?");
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
