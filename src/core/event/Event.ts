import { assert } from "../../utils/assert";
import { just, type Maybe } from "../../utils/Maybe";
import type { State } from "../dynamic/State";
import { Node } from "../Node";

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

	*outgoings(): Iterable<Node> {
		yield* this.childEvents;
		yield* this.dependenedStates;
	}

	// @internal
	listen(event: Event<unknown>): () => void {
		return event.withActivation(() => {
			event.childEvents.add(this);

			this.timeline.reorder(event, this);

			return () => {
				event.childEvents.delete(this);
			};
		});
	}

	// @internal
	abstract getEmission(): Maybe<T>;

	safeGetEmission(from: Node): Maybe<T> {
		assert(
			new Set(from.incomings()).has(this),
			`Node(${from.getTag()}) does not have Event(${this.getTag()}) as incoming`,
		);
		assert(
			new Set(this.outgoings()).has(from),
			`Event(${this.getTag()}) does not have Node(${from.getTag()}) as outgoing`,
		);
		assert(this.rank < from.rank, "Event ordering is incorrect");

		return this.getEmission();
	}

	// @internal
	writeOn(state: State<T>) {
		return this.withActivation(() => {
			this.dependenedStates.add(state);
			this.timeline.reorder(this, state);

			return () => {
				this.dependenedStates.delete(state);
			};
		});
	}

	protected activate(): void {}
	protected deactivate(): void {}

	withActivation(fn: () => () => void) {
		const wasActive = this.isActive;
		const dispose = fn();

		if (!wasActive && this.isActive) this.activate();

		return () => {
			dispose();

			if (!this.isActive) this.deactivate();
		};
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

	// FIXME: true?
	incomings() {
		return [];
	}

	commit() {
		this.maybeLastEmission = undefined;
	}
}
