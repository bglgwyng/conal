import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";

export abstract class Behavior<T> {
	dependedBehaviors: Set<Behavior<any>> = new Set();

	abstract read(): T;
	abstract updated: Event<T>;

	constructor(public timeline: Timeline) {}
}
