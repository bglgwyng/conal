import { assert } from "../../utils/assert";
import { just, type Maybe } from "../../utils/Maybe";
import type { State } from "../dynamic/State";
import { Node } from "../Node";
import type { TopoNode } from "../utils/IncrementalTopo";

export abstract class Event<T> extends Node {
	childEvents: Set<Event<unknown>> = new Set();
	dependenedStates: Set<State<T>> = new Set();

	// biome-ignore lint/suspicious/noExplicitAny: to satisfy covariance, can't be unknown
	effects: (readonly [(value: any) => void, Emmittable<unknown>])[] = [];

	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependenedStates.size > 0 ||
			this.childEvents.size > 0
		);
	}

	on<U>(fn: (value: T) => U): readonly [Event<U>, () => void] {
		const { isActive } = this;

		const effectEvent = new Emmittable<U>(this.timeline);
		effectEvent.setTag(`Effect(${this._tag})`);

		const effect = [fn, effectEvent] as const;
		this.effects.push(effect);
		if (!isActive) this.activate();

		this.timeline.topo.reorder(this, effectEvent);

		return [
			effectEvent,
			() => {
				this.effects.splice(this.effects.indexOf(effect), 1);

				if (!this.isActive) this.deactivate();
			},
		];
	}

	*outcomings() {
		yield* this.childEvents;
		yield* this.dependenedStates;
	}

	// @internal
	listen(event: Event<unknown>): () => void {
		assert(this.isActive, "Event is not active");

		const { isActive } = event;
		event.childEvents.add(this);
		this.timeline.topo.reorder(event, this);

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
		// TODO: the next line should be mandatory, but it's not for now
		// this.timeline.topo.reorder(this, state);

		if (!isActive) this.activate();

		return () => {
			this.dependenedStates.delete(state);

			if (!this.isActive) this.deactivate();
		};
	}

	protected activate(): void {}
	protected deactivate(): void {}
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

	// FIXME: true?
	incomings() {
		return [];
	}

	commit() {
		this.maybeLastEmission = undefined;
	}
}
