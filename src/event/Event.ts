import type { State } from "../behavior/State";
import type { Timeline } from "../Timeline";
import type { Affine } from "../utils/affine";

export class Event<T> {
	timeline: Timeline;

	deriveEvents: Set<EventRelation<T, any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();
	effects: ((value: T) => unknown)[] = [];

	constructor(timeline: Timeline, _options?: { debugLabel?: string }) {
		this.timeline = timeline;
	}

	relate<U>(fn: EventRelation<T, U>): () => void {
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

	on(fn: (value: T) => unknown): () => void {
		this.effects.push(fn);

		return () => {
			this.effects.splice(this.effects.indexOf(fn), 1);
		};
	}

	writeOn(state: State<T>) {
		this.dependenedStates.add(state);

		return () => {
			this.dependenedStates.delete(state);
		};
	}
}

export type EventRelation<T1, T2> = {
	causality: Causality;
	to: Event<T2>;
	propagate: (x: T1) => Affine<T2> | undefined;
};

// TODO: add maybe, always things
export enum Causality {
	Only,
	OneOfMany,
}

export type EventEmission<T> = {
	event: Event<T>;
	value: T;
};
