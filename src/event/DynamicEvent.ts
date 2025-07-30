import type { Behavior } from "../behavior/Behavior";
import type { Timeline } from "../Timeline";
import type { Maybe } from "../utils/Maybe";
import { Event } from "./Event";

export class DynamicEvent<T> extends Event<T> {
	constructor(
		timeline: Timeline,
		private behavior: Behavior<Event<T>>,
		options?: { debugLabel?: string },
	) {
		super(timeline, options);
	}

	takeEmittedValue(): Maybe<T> {
		return this.behavior.read().takeEmittedValue();
	}

	protected activate(): void {
		this.dispose = this.listen(this.behavior.read());
		this.disposeBehaviorUpdated = this.behavior.updated.on((event) => {
			// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
			this.dispose!();
			this.dispose = this.listen(event);
		});
	}

	protected deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.dispose!();
		this.dispose = undefined;

		// biome-ignore lint/style/noNonNullAssertion: `disposeBehaviorUpdated` is set in activate
		this.disposeBehaviorUpdated!();
		this.disposeBehaviorUpdated = undefined;
	}

	private dispose?: () => void;
	private disposeBehaviorUpdated?: () => void;
}
