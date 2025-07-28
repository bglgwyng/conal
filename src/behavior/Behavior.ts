import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";

export abstract class Behavior<T> {
	dependedBehaviors: Set<Behavior<any>> = new Set();

	read(): T {
		return this.readNextValue()[0];
	}
	abstract updated: Event<T>;

	abstract readNextValue(): readonly [value: T, isUpdated: boolean];

	constructor(public timeline: Timeline) {}
}
