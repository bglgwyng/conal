import type { State } from "../behavior/State";
import { Node } from "../Node";
import type { Timeline } from "../Timeline";
import type { Affine } from "../utils/affine";

export abstract class Event<T> extends Node {
	debugLabel?: string;

	childEvents: Set<Event<any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();
	effects: ((value: T) => unknown)[] = [];

	constructor(timeline: Timeline, _options?: { debugLabel?: string }) {
		super(timeline);
		this.debugLabel = _options?.debugLabel;
	}

	relate<U>(fn: EventRelation<T, U>): () => void {
		this.childEvents.add(fn.to);

		return () => {
			this.childEvents.delete(fn.to);
		};
	}

	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependenedStates.size > 0 ||
			this.childEvents.size > 0
		);
	}

	abstract takeEmittedValue(): (() => T) | undefined;

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

export type EventRelation<T1, T2> =
	| {
			causality: Causality.Only;
			to: Event<T2>;
			propagate: (x: T1) => Affine<T2> | undefined;
	  }
	| {
			causality: Causality.OneOfMany;
			to: Event<T2>;
			propagate: (x: T1) => void;
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
