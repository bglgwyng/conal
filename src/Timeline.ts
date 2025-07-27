import assert from "assert";
import { State } from "./behavior/State";
import type { Effect } from "./event/Effect";
import {
	Causality,
	type DeferredEmittingEvent,
	type Event,
	type EventEmission,
} from "./event/Event";
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
		let eventEmissions: EventEmission<unknown>[] = [];
		for (const source of this.emittingSources) {
			eventEmissions.push({
				event: source,
				value: source.takeLastEmittedValue(),
			});
		}
		this.emittingSources.clear();

		const pendingEffects: Effect[] = [];
		const stateUpdates: StateUpdate<unknown>[] = [];

		while (eventEmissions.length > 0) {
			const deferredEventEmissions: Set<DeferredEmittingEvent<unknown>> =
				new Set();

			while (eventEmissions.length > 0) {
				while (true) {
					const nextEventEmissions: EventEmission<unknown>[] = [];

					for (const { event, value } of eventEmissions) {
						if (!event.isActive) continue;

						for (const effect of event.effects) {
							pendingEffects.push(() => effect(value));
						}

						for (const state of event.dependenedStates) {
							stateUpdates.push([state, value]);
						}

						for (const {
							causality,
							to: child,
							propagate,
						} of event.deriveEvents) {
							if (!child.isActive) continue;

							const childEmission = propagate(value);

							if (causality === Causality.Only) {
								if (!childEmission) continue;
								nextEventEmissions.push({
									event: child,
									value: childEmission(),
								});
							} else {
								deferredEventEmissions.add(
									child as DeferredEmittingEvent<unknown>,
								);
							}
						}
					}
					if (nextEventEmissions.length === 0) break;

					eventEmissions = nextEventEmissions;
				}

				eventEmissions = [];
			}

			for (const event of deferredEventEmissions) {
				const value = event.takeEmittedValue();
				eventEmissions.push({ event, value });
			}
		}

		for (const [state, newValue] of stateUpdates) {
			state.value = newValue;
		}

		for (const effect of pendingEffects) {
			effect();
		}

		this.timestamp++;
	}

	beforeFlush() {
		assert.fail();
	}

	afterFlush() {
		assert.fail();
	}
}

type StateUpdate<T> = readonly [state: State<T>, newValue: T];
