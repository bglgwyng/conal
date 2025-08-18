import { assert } from "../../utils/assert";
import { just, type Maybe } from "../../utils/Maybe";
import type { Timeline } from "../Timeline";
import { DerivedEvent } from "./DerivedEvent";
import type { Event } from "./Event";

export class TransformedEvent<T, U> extends DerivedEvent<T> {
	constructor(
		timeline: Timeline,
		public readonly parent: Event<U>,
		public readonly fn: (value: U) => T,
	) {
		super(timeline);
	}

	incomings() {
		return [this.parent];
	}

	deriveEmission() {
		const parentEmission = this.parent.getEmission();
		if (!parentEmission) return;

		try {
			const maybeValue = just(this.fn(parentEmission()));

			this.timeline.needCommit(this);

			return maybeValue;
		} catch (error) {
			if (error === Discard) return;

			throw error;
		}
	}

	activate() {
		assert(this.isActive, "Event is not active");

		this.safeEstablishEdge(() => {
			this.dispose = this.listen(this.parent);
		}, [this.parent]);
	}

	deactivate() {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.dispose!();
		this.dispose = undefined;
	}

	dispose?: () => void;
}

export const Discard = Symbol("Discard");
