import type { Event } from "../event/Event";
import { Node } from "../Node";
import type { ComputedBehavior } from "./ComputedBehavior";
import type { State } from "./State";

export abstract class Behavior<T> extends Node {
	dependedBehaviors: Set<ComputedBehavior<any>> = new Set();

	read = (): T => {
		const { timeline } = this;
		if (timeline.isTracking) timeline.reportRead(this);

		return timeline.isReadingNextValue
			? this.readNextValue().value
			: this.readCurrentValue();
	};

	abstract updated: Event<T>;

	on<U>(fn: (value: T) => U): readonly [state: State<U>, dispose: () => void] {
		const [effectfulUpdateEvent, dispose] = this.updated.on(fn);

		return [
			this.timeline.state(fn(this.readCurrentValue()), effectfulUpdateEvent),
			dispose,
		];
	}

	abstract readCurrentValue(): T;
	abstract readNextValue(): { value: T; isUpdated: boolean };
}
