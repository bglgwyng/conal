import assert from "assert";
import { State } from "./behavior/State";
import type { Event } from "./event/Event";
import { MergedEvent } from "./event/MergedEvent";
import { Source } from "./event/Source";
import { Timeline } from "./Timeline";

export function state<T>(initialValue: T, updated: Event<T>): State<T> {
	const { activeTimeline } = Timeline;
	assert(activeTimeline, "Timeline is not active");

	return new State(activeTimeline, initialValue, updated);
}

export function source<T>(): Source<T> {
	const { activeTimeline } = Timeline;
	assert(activeTimeline, "Timeline is not active");

	return new Source(activeTimeline);
}

export function merge<L, R>(
	left: Event<L>,
	right: Event<R>,
): MergedEvent<L, R> {
	const { activeTimeline } = Timeline;
	assert(activeTimeline, "Timeline is not active");

	assert(
		left.timeline === activeTimeline,
		"Left event is not from the active timeline",
	);
	assert(
		right.timeline === activeTimeline,
		"Right event is not from the active timeline",
	);

	return new MergedEvent(activeTimeline, left, right);
}
