import type { Event } from "./Event";
import type { Timeline } from "./Timeline";

export type Behavior<T> = {
	timeline: Timeline;

	read(): T;
	updated: Event<T>;
};
