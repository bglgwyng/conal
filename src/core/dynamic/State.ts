import assert from "node:assert";
import type { Maybe } from "../../utils/Maybe";
import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import { Dynamic } from "./Dynamic";

export class State<T> extends Dynamic<T> {
	public value: T;
	public maybeNextValue: Maybe<T>;

	constructor(
		timeline: Timeline,
		initialValue: T,
		public readonly updated: Event<T>,
	) {
		super(timeline);
		this.value = initialValue;

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
		return this.value;
	}

	readNext(): { value: T; isUpdated: boolean } {
		const emission = this.updated.getEmission();

		return emission
			? { value: emission(), isUpdated: true }
			: { value: this.readCurrent(), isUpdated: false };
	}

	*proceed() {
		this.maybeNextValue = this.updated.safeGetEmission(this);

		yield* this.dependedDynamics;
	}

	commit(): void {
		const { maybeNextValue } = this;
		if (!maybeNextValue) return;
		this.maybeNextValue = undefined;

		this.value = maybeNextValue();
	}
}
