import { ComputedDynamic } from "./core/dynamic/ComputedDynamic";
import { State } from "./core/dynamic/State";
import { Source } from "./core/event/Source";
import { SwitchableEvent } from "./core/event/SwitchableEvent";
import { TransformedEvent } from "./core/event/TransformedEvent";
import { Dynamic } from "./Dynamic";
import { Event } from "./Event";
import { getActiveTimeline, useTimeline, withTimeline } from "./globalContext";
import type { Timeline } from "./Timeline";

export function build<T>(timeline: Timeline): Disposable;
export function build<T>(timeline: Timeline, fn: () => T): T;
export function build<T>(timeline: Timeline, fn?: () => T): T | Disposable {
	if (fn) return withTimeline(timeline, fn);
	return useTimeline(timeline);
}

export function state<T>(initialValue: T, updated: Event<T>): Dynamic<T> {
	const timeline = getActiveTimeline();

	return new Dynamic(new State(timeline, initialValue, updated.internalEvent));
}

export function computed<T>(fn: () => T): Dynamic<T> {
	const timeline = getActiveTimeline();

	return new Dynamic(new ComputedDynamic(timeline, fn));
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
	fn: (value: T) => U,
	event: Event<T>,
): Event<U> {
	const timeline = getActiveTimeline();

	return new Event(new TransformedEvent(timeline, event.internalEvent, fn));
}

export function switchable<T>(dynamic: Dynamic<Event<T>>): Event<T> {
	const timeline = getActiveTimeline();

	return new Event(
		new SwitchableEvent(
			timeline,
			dynamic.internal,
			(event) => event.internalEvent,
		),
	);
}
