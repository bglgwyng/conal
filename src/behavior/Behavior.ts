import type { Event } from "../event/Event";
import { Node } from "../Node";
import type { DerivedBehavior } from "./DerivedBehavior";

export abstract class Behavior<T> extends Node {
	dependedBehaviors: Set<DerivedBehavior<any>> = new Set();

	read(): T {
		const { timeline } = this;
		if (timeline.isTracking) timeline.reportRead(this);

		return timeline.isReadingNextValue
			? this.readNextValue().value
			: this.readCurrentValue();
	}
	abstract updated: Event<T>;

	abstract readCurrentValue(): T;
	abstract readNextValue(): { value: T; isUpdated: boolean };
}
