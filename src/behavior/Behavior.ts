import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import type { DerivedBehavior } from "./DerivedBehavior";

export abstract class Behavior<T> {
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

	constructor(public timeline: Timeline) {}
}
