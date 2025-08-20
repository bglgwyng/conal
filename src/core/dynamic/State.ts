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
			updated.dependenedStates.add(this);
			this.timeline.reorder(updated, this);

			return () => {
				updated.dependenedStates.delete(this);
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

	*proceed() {
		this.maybeNextValue = this.updated.safeGetEmission(this);

		yield* this.dependedDynamics;

		return () => {
			const maybeNextValue = this.maybeNextValue;
			if (!maybeNextValue) return;

			this.value = maybeNextValue();
			this.maybeNextValue = undefined;
		};
	}

	prepareUpdate() {
		assert.fail();
	}

	commit(): void {
		assert.fail();
	}
}
