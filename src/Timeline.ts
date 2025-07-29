import assert from "assert";
import { emit } from "process";
import type { Behavior } from "./behavior/Behavior";
import type { DerivedBehavior } from "./behavior/DerivedBehavior";
import { State } from "./behavior/State";
import type { Effect } from "./event/Effect";
import type { Event } from "./event/Event";
import { Source } from "./event/Source";

export class Timeline {
	timestamp = 0;

	emittingSources = new Set<Source<unknown>>();

	isTracking = false;
	isReadingNextValue = false;

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
		const processedDerivedBehaviors: Set<DerivedBehavior<unknown>> = new Set();

		while (maybeEmittingEvents.length > 0) {
			const event = maybeEmittingEvents.shift()!;
			// TODO: recover
			// assert(event.isActive, "Event is not active");
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

			for (const state of event.dependenedStates) {
				for (const behavior of collectAllDependentBehaviors(
					state.dependedBehaviors,
				)) {
					// TODO: recover
					// if (!behavior.updated.isActive) continue;
					if (processedDerivedBehaviors.has(behavior)) continue;
					processedDerivedBehaviors.add(behavior);

					maybeEmittingEvents.push(behavior.updated);
				}
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

		for (const behavior of processedDerivedBehaviors) {
			behavior.commit();
		}

		for (const event of processedEvents) {
			event.cleanUpLastEmittedValue();
		}

		this.timestamp = this.nextTimestamp;

		function* collectAllDependentBehaviors(
			behaviors: Iterable<DerivedBehavior<unknown>>,
		): IterableIterator<DerivedBehavior<unknown>> {
			for (const behavior of behaviors) {
				yield behavior;
				yield* collectAllDependentBehaviors(behavior.dependedBehaviors);
			}
		}
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
		this.isTracking = true;
		this.reads.push(new Set());

		return () => {
			// biome-ignore lint/style/noNonNullAssertion: pop the set that was pushed above
			const dependencies = this.reads.pop()!;
			if (this.reads.length === 0) this.isTracking = false;

			return dependencies;
		};
	}

	startReadingNextValue() {
		this.isReadingNextValue = true;

		return () => {
			this.isReadingNextValue = false;
		};
	}

	get nextTimestamp() {
		return this.timestamp + 1;
	}
}

type StateUpdate<T> = readonly [state: State<T>, newValue: T];
