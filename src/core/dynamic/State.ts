import assert from "assert";
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
		public updated: Event<T>,
	) {
		super(timeline);
		this.value = initialValue;
		this.updated.writeOn(this);
	}

	*incomings() {
		yield this.updated;
	}

	*outcomings() {
		yield* this.dependedDynamics;
	}

	readCurrent(): T {
		return this.value;
	}

	*proceed() {
		this.maybeNextValue = this.updated.getEmission();

		yield* this.dependedDynamics;

		return () => {
			const maybeNextValue = this.maybeNextValue;
			if (!maybeNextValue) return;

			this.value = maybeNextValue();
			this.maybeNextValue = undefined;
		};
	}

	prepareUpdate() {
		this.maybeNextValue = this.updated.getEmission();
		this.timeline.needCommit(this);
	}

	commit(): void {
		assert.fail();
	}
}
