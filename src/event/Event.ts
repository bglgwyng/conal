import assert from "assert";
import type { State } from "../behavior/State";
import { Node } from "../Node";
import type { Timeline } from "../Timeline";
import { just, type Maybe } from "../utils/Maybe";

export abstract class Event<T> extends Node {
	debugLabel?: string;

	childEvents: Set<Event<any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();
	effects: (readonly [(value: any) => void, EffectEvent<any>])[] = [];

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

	on<U>(fn: (value: T) => U): readonly [EffectEvent<U>, () => void] {
		assert(this.timeline.canUpdateNetwork, "Cannot update network");

		const { isActive } = this;

		const effectEvent = new EffectEvent<U>(this.timeline);

		const effect = [fn, effectEvent] as const;
		this.effects.push(effect);
		if (!isActive) this.activate();

		return [
			effectEvent,
			() => {
				this.effects.splice(this.effects.indexOf(effect), 1);

				if (!this.isActive) this.deactivate();
			},
		];
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

export class EffectEvent<T> extends Event<T> {
	maybeLastEmitedValue: Maybe<T>;

	emit(value: T) {
		this.maybeLastEmitedValue = just(value);

		this.timeline.needCommit(this);
	}

	takeEmittedValue() {
		return this.maybeLastEmitedValue;
	}

	commit() {
		this.maybeLastEmitedValue = undefined;
	}
}
