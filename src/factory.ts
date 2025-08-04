import { Behavior } from "./Behavior";
import { ComputedBehavior } from "./core/behavior/ComputedBehavior";
import { State } from "./core/behavior/State";
import { Source } from "./core/event/Source";
import { TransformedEvent } from "./core/event/TransformedEvent";
import { Event } from "./Event";
import { getActiveTimeline, useTimeline, withTimeline } from "./GlobalContext";
import type { Timeline } from "./Timeline";

export function build<T>(timeline: Timeline): Disposable;
export function build<T>(timeline: Timeline, fn: () => T): T;
export function build<T>(timeline: Timeline, fn?: () => T): T | Disposable {
	if (fn) return withTimeline(timeline, fn);
	return useTimeline(timeline);
}

export function state<T>(initialValue: T, updated: Event<T>): Behavior<T> {
	const timeline = getActiveTimeline();

	return new Behavior(new State(timeline, initialValue, updated.internalEvent));
}

export function computed<T>(fn: () => T): Behavior<T> {
	const timeline = getActiveTimeline();

	return new Behavior(new ComputedBehavior(timeline, fn));
}

export function source<T>(): readonly [
	event: Event<T>,
	emit: (value: T) => void,
] {
	const timeline = getActiveTimeline();

	const source = new Source<T>(timeline);

	return [new Event(source), source.emit];
}

export function transform<T, U>(
	event: Event<T>,
	fn: (value: T) => U,
): Event<U> {
	const timeline = getActiveTimeline();

	return new Event(new TransformedEvent(timeline, event.internalEvent, fn));
}
