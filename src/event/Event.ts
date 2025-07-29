import type { State } from "../behavior/State";
import { Node } from "../Node";
import type { Timeline } from "../Timeline";
import type { Maybe } from "../utils/Maybe";

export abstract class Event<T> extends Node {
	debugLabel?: string;

	childEvents: Set<Event<any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();
	effects: ((value: T) => unknown)[] = [];

	constructor(timeline: Timeline, _options?: { debugLabel?: string }) {
		super(timeline);
		this.debugLabel = _options?.debugLabel;
	}

	relate(event: Event<any>): () => void {
		this.childEvents.add(event);

		return () => {
			this.childEvents.delete(event);
		};
	}

	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependenedStates.size > 0 ||
			this.childEvents.size > 0
		);
	}

	abstract takeEmittedValue(): Maybe<T>;

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
