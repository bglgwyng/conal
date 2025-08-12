import { ComputedDynamic } from "./core/dynamic/ComputedDynamic";
import { MergedEvent, type These } from "./core/event/MergedEvent";
import { Source } from "./core/event/Source";
import { SwitchingEvent } from "./core/event/SwitchingEvent";
import { Timeline as InternalTimeline } from "./core/Timeline";
import { Dynamic } from "./Dynamic";
import { Event } from "./Event";
import { Incremental } from "./Incremental";
import { UnsafeIncremental } from "./UnsafeIncremental";

export class Timeline {
	internal: InternalTimeline;

	constructor(options: TimelineOptions) {
		this.internal = new InternalTimeline({
			onSourceEmission: (event, proceed) => options.onSourceEmission(proceed),
		});
	}

	source<T>(): [Event<T>, (value: T) => void] {
		const source = new Source<T>(this.internal);

		return [new Event(this, source), source.emit];
	}

	state<T>(initialValue: T, updated: Event<T>): Dynamic<T> {
		return new Dynamic(
			this,
			this.internal.state(initialValue, updated.internal),
		);
	}

	computed<T>(fn: () => T, equal?: (x: T, y: T) => boolean): Dynamic<T> {
		return new Dynamic(this, new ComputedDynamic(this.internal, fn, equal));
	}

	switching<T>(dynamic: Dynamic<Event<T>>): Event<T> {
		return new Event(
			this,
			new SwitchingEvent(
				this.internal,
				dynamic.internal,
				(event) => event.internal,
			),
		);
	}

	merge<T1, T2>(event1: Event<T1>, event2: Event<T2>): Event<These<T1, T2>> {
		return new Event(
			this,
			new MergedEvent(this.internal, event1.internal, event2.internal),
		);
	}

	incremental<T, D>(
		initialValue: T,
		transition: Event<readonly [T, D]>,
	): Incremental<T, D> {
		return new Incremental(this, initialValue, transition);
	}

	unsafeIncremental<T, D>(
		read: () => T,
		transition: Event<readonly [T, D]>,
	): Incremental<T, D> {
		return new UnsafeIncremental(this, read, transition);
	}

	get never() {
		return new Event(this, this.internal.never);
	}

	queueTaskAfterProceed(task: () => void) {
		this.internal.queueTaskAfterProceed(task);
	}
}

export type TimelineOptions = {
	onSourceEmission: (proceed: () => void) => void;
};

export function proceedImmediately(proceed: () => void) {
	proceed();
}
