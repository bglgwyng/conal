import { just, type Maybe } from "../../utils/Maybe";
import type { Event } from "../event/Event";
import { type ProceedEffect, propagate } from "../Node";
import type { Timeline } from "../Timeline";
import { Dynamic } from "./Dynamic";
import { type Pull, pullCurrentWithoutTracking } from "./pull";

export class UnsafeDynamic<T> extends Dynamic<T> {
	memoized: Maybe<T>;
	#read: Pull<T>;

	constructor(
		timline: Timeline,
		read: Pull<T>,
		readonly updated: Event<T>,
	) {
		super(timline);
		this.#read = read;

		updated.withActivation(() => {
			updated.dependedDynamics.add(this);
			this.timeline.reorder(updated, this);

			return () => {
				updated.dependedDynamics.delete(this);
			};
		});
	}

	*incomings() {
		yield this.updated;
	}

	*outgoings() {
		yield* this.dependedDynamics;
	}

	readCurrent(): T {
		if (this.memoized) return this.memoized();

		const current = pullCurrentWithoutTracking(this.#read);
		this.memoized = just(current);

		return current;
	}

	readNext(): { value: T; isUpdated: boolean } {
		const emission = this.updated.getEmission();

		return emission
			? { value: emission(), isUpdated: true }
			: { value: this.readCurrent(), isUpdated: false };
	}

	*proceed(): Iterable<ProceedEffect> {
		for (const dynamic of this.dependedDynamics) yield* propagate(dynamic);
	}

	commit() {
		this.memoized = undefined;
	}
}
