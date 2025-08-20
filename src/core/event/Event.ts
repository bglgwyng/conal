import { assert } from "../../utils/assert";
import { just, type Maybe } from "../../utils/Maybe";
import type { Dynamic } from "../dynamic/Dynamic";
import { Node } from "../Node";

export abstract class Event<T> extends Node {
	listeners: Set<
		readonly [event: Event<unknown>, fn: (value: unknown) => void]
	> = new Set();
	dependedDynamics: Set<Dynamic<T>> = new Set();

	// biome-ignore lint/suspicious/noExplicitAny: to satisfy covariance, can't be unknown
	effects: (readonly [(value: any) => void, Emmittable<unknown>])[] = [];

	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependedDynamics.size > 0 ||
			this.listeners.size > 0
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
		for (const [event] of this.listeners) yield event;
		yield* this.dependedDynamics;
	}

	// @internal
	listen<U>(event: Event<U>, fn: (value: U) => void): () => void {
		return event.withActivation(() => {
			const listener = [this, fn as (value: unknown) => void] as const;
			event.listeners.add(listener);

			this.timeline.reorder(event, this);

			return () => {
				event.listeners.delete(listener);
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
