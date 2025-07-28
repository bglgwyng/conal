import assert from "assert";
import { emit } from "process";
import type { Behavior } from "./behavior/Behavior";
import { State } from "./behavior/State";
import type { Effect } from "./event/Effect";
import type { Event } from "./event/Event";
import { Source } from "./event/Source";

export class Timeline {
	timestamp = 0;

	emittingSources = new Set<Source<unknown>>();

	state<T>(initialValue: T, updated: Event<T>): State<T> {
		return new State(this, initialValue, updated);
	}

	source<T>(): Source<T> {
		return new Source(this);
	}

	markEmitting(event: Source<unknown>) {
		this.emittingSources.add(event);
	}

	flush() {
		const maybeEmittingEvents: Event<unknown>[] = [];
		for (const source of this.emittingSources) {
			if (!source.isActive) continue;

			maybeEmittingEvents.push(source);
		}
		this.emittingSources.clear();

		const pendingEffects: Effect[] = [];
		const stateUpdates: StateUpdate<unknown>[] = [];
		const processedEvents: Set<Event<unknown>> = new Set();

		while (maybeEmittingEvents.length > 0) {
			const event = maybeEmittingEvents.shift()!;
			if (processedEvents.has(event)) continue;
			processedEvents.add(event);

			const valueFn = event.takeEmittedValue();
			if (!valueFn) continue;

			const value = valueFn();

			for (const state of event.dependenedStates) {
				stateUpdates.push([state, value]);
			}
			for (const effect of event.effects) {
				pendingEffects.push(() => effect(value));
			}

			for (const childEvent of event.childEvents) {
				maybeEmittingEvents.push(childEvent);
			}
		}

		for (const [state, newValue] of stateUpdates) {
			state.value = newValue;
		}

		for (const effect of pendingEffects) {
			effect();
		}

		for (const event of processedEvents) {
			event.cleanUpLastEmittedValue();
		}

		this.timestamp++;
	}

	beforeFlush() {
		assert.fail();
	}

	afterFlush() {
		assert.fail();
	}

	reads: Set<Behavior<any>>[] = [];

	reportRead(behavior: Behavior<any>) {
		this.reads.at(-1)?.add(behavior);
	}

	startTrackingReads() {
		this.reads.push(new Set());
	}

	stopTrackingReads() {
		const activeReadTracking = this.reads.pop();
		assert(activeReadTracking, "No active read tracking");

		return activeReadTracking;
	}
}

type StateUpdate<T> = readonly [state: State<T>, newValue: T];
