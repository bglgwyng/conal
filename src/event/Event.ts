import { assert } from "console";
import type { State } from "../behavior/State";
import { Node } from "../Node";
import type { Timeline } from "../Timeline";
import type { Maybe } from "../utils/Maybe";

export abstract class Event<T> extends Node {
	debugLabel?: string;

	childEvents: Set<Event<any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();
	effects: ((value: any) => unknown)[] = [];

	constructor(timeline: Timeline, _options?: { debugLabel?: string }) {
		super(timeline);
		this.debugLabel = _options?.debugLabel;
	}

	listen(event: Event<any>): () => void {
		assert(this.isActive, "Event is not active");

		const { isActive } = event;
		event.childEvents.add(this);

		if (!isActive) event.activate();

		return () => {
			event.childEvents.delete(this);

			if (event.isActive) event.deactivate();
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
		const { isActive } = this;

		this.effects.push(fn);
		if (!isActive) this.activate();

		return () => {
			this.effects.splice(this.effects.indexOf(fn), 1);

			if (!this.isActive) this.deactivate();
		};
	}

	writeOn(state: State<T>) {
		const { isActive } = this;
		this.dependenedStates.add(state);

		if (!isActive) this.activate();

		return () => {
			this.dependenedStates.delete(state);

			if (!this.isActive) this.deactivate();
		};
	}

	protected activate(): void {}
	protected deactivate(): void {}
}
