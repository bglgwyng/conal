import assert from "assert";
import type { State } from "../behavior/State";
import type { Timeline } from "../Timeline";

export class Event<T> {
	timeline: Timeline;

	deriveEvents: Set<EventRelation<T, any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();

	effects: ((value: T) => unknown)[] = [];

	constructor(timeline: Timeline, _options?: { debugLabel?: string }) {
		this.timeline = timeline;
	}

	listen<U>(fn: EventRelation<T, U>): () => void {
		this.deriveEvents.add(fn);

		return () => {
			this.deriveEvents.delete(fn);
		};
	}

	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependenedStates.size > 0 ||
			this.deriveEvents.size > 0
		);
	}

	push<U>(_fn: (value: T) => Event<U>): Event<U> {
		assert.fail();
	}

	pushAlways<U>(_fn: (value: T) => Event<U>): Event<U> {
		assert.fail();
	}

	on(fn: (value: T) => unknown): () => void {
		this.effects.push(fn);

		return () => {
			this.effects.splice(this.effects.indexOf(fn), 1);
		};
	}

	write(state: State<T>) {
		this.dependenedStates.add(state);

		return () => {
			this.dependenedStates.delete(state);
			if (!this.isActive) {
			}
		};
	}
}

export type EventRelation<T1, T2> = {
	propagate: (x: T1) => EventEmission<T2> | undefined;
	to: Event<T2>;
};

export type EventEmission<T> = {
	event: Event<T>;
	value: T;
};
