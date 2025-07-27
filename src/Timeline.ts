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
import { fixGenerator } from "./utils/fixGenerator";

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
		const { executeEmission, propagateEvents } = this;

		const eventEmissions: EventEmission<unknown>[] = [];
		for (const source of this.emittingSources) {
			if (!source.isActive) continue;

			eventEmissions.push({
				event: source,
				value: source.takeLastEmittedValue(),
			});
		}
		this.emittingSources.clear();

		const pendingEffects: Effect[] = [];
		const stateUpdates: StateUpdate<unknown>[] = [];

		fixGenerator(eventEmissions, function* (emissions) {
			const deferredEventEmissions: Set<DeferredEmittingEvent<unknown>> =
				propagateEvents(emissions);

			for (const event of deferredEventEmissions) {
				const value = event.takeEmittedValue();
				yield { event, value };
			}
		});

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

	propagateEvents = (emissions: EventEmission<unknown>[]) => {
		const { executeEmission } = this;

		const deferredEventEmissions = new Set<DeferredEmittingEvent<unknown>>();

		fixGenerator(emissions, function* (emissions) {
			for (const emission of emissions) {
				const { event, value } = emission;
				// TODO: separate it
				executeEmission(emission);

				for (const { causality, to: child, propagate } of event.deriveEvents) {
					if (!child.isActive) continue;

					const childEmission = propagate(value);

					if (causality === Causality.Only) {
						if (!childEmission) continue;
						yield {
							event: child,
							value: childEmission(),
						};
					} else {
						deferredEventEmissions.add(child as DeferredEmittingEvent<unknown>);
					}
				}
			}
		});

		return deferredEventEmissions;
	};

	private executeEmission = (emission: EventEmission<unknown>) => {
		const { event, value } = emission;
		for (const effect of event.effects) {
			effect(value);
		}
		for (const state of event.dependenedStates) {
			state.value = value;
		}
	};
}

type StateUpdate<T> = readonly [state: State<T>, newValue: T];
