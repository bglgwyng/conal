import type { Timeline } from "../../Timeline";
import type { Maybe } from "../../utils/Maybe";
import type { Behavior } from "../behavior/Behavior";
import type { Metadata } from "../Node";
import { Event } from "./Event";

export class SwitchableEvent<U, T> extends Event<T> {
	constructor(
		timeline: Timeline,
		public readonly behavior: Behavior<U>,
		public readonly extractEvent: (behavior: U) => Event<T>,
		metadata?: Metadata,
	) {
		super(timeline, metadata);
	}

	getEmittedValue(): Maybe<T> {
		return this.extractEvent(this.behavior.read()).getEmittedValue();
	}

	activate(): void {
		this.dispose = this.listen(this.extractEvent(this.behavior.read()));
		[, this.disposeBehaviorUpdated] = this.behavior.updated.on((event) => {
			// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
			this.dispose!();
			this.dispose = this.listen(this.extractEvent(event));
		});
	}

	deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.dispose!();
		this.dispose = undefined;

		// biome-ignore lint/style/noNonNullAssertion: `disposeBehaviorUpdated` is set in activate
		this.disposeBehaviorUpdated!();
		this.disposeBehaviorUpdated = undefined;
	}

	dispose?: () => void;
	disposeBehaviorUpdated?: () => void;
}
