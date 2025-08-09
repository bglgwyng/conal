import assert from "assert";
import { just, type Maybe } from "../../utils/Maybe";
import type { State } from "../behavior/State";
import { Node } from "../Node";

export abstract class Event<T> extends Node {
	childEvents: Set<Event<any>> = new Set();
	dependenedStates: Set<State<T>> = new Set();
	effects: (readonly [(value: any) => void, EffectEvent<any>])[] = [];

	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependenedStates.size > 0 ||
			this.childEvents.size > 0
		);
	}

	on<U>(fn: (value: T) => U): readonly [EffectEvent<U>, () => void] {
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

	// @internal
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

	// @internal
	abstract getEmission(): Maybe<T>;

	// @internal
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
	maybeLastEmission: Maybe<T>;

	emit(value: T) {
		this.maybeLastEmission = just(value);

		this.timeline.needCommit(this);
	}

	getEmission() {
		return this.maybeLastEmission;
	}

	commit() {
		this.maybeLastEmission = undefined;
	}
}

export class Emmittable<T> extends Event<T> {
	maybeLastEmission: Maybe<T>;

	emit(value: T) {
		this.maybeLastEmission = just(value);

		this.timeline.needCommit(this);
	}

	getEmission() {
		return this.maybeLastEmission;
	}

	commit() {
		this.maybeLastEmission = undefined;
	}
}
