import assert from "assert";
import type { Behavior } from "./core/behavior/Behavior";
import type { DerivedBehavior } from "./core/behavior/DerivedBehavior";
import { State } from "./core/behavior/State";
import type { Event } from "./core/event/Event";
import { Never } from "./core/event/Never";
import { Source } from "./core/event/Source";
import type { Node } from "./core/Node";
import { DedupQueue } from "./utils/DedupQueue";
import type { Maybe } from "./utils/Maybe";

export class Timeline {
	#timestamp = 0;
	get timestamp() {
		return this.#timestamp;
	}

	get nextTimestamp() {
		return this.#timestamp + 1;
	}

	#isProceeding = false;
	get isProceeding() {
		return this.#isProceeding;
	}

	#isReadingNextValue = false;
	get isReadingNextValue() {
		return this.#isReadingNextValue;
	}

	#hasStarted = false;
	get hasStarted() {
		return this.#hasStarted;
	}

	#isRunningEffect = true;
	get isRunningEffect() {
		return this.#isRunningEffect;
	}

	start() {
		assert(!this.#hasStarted, "Timeline has already started");

		this.#hasStarted = true;
		this.#isRunningEffect = false;
	}

	get canUpdateNetwork() {
		return this.#isRunningEffect || !this.#hasStarted;
	}

	state<T>(initialValue: T, updated: Event<T>): State<T> {
		return new State(this, initialValue, updated);
	}

	source<T>(): Source<T> {
		return new Source(this);
	}

	never = new Never<any>(this);

	proceed() {
		assert(this.#hasStarted, "Timeline has not started");
		assert(!this.#isProceeding, "Timeline is already proceeding");

		this.#isProceeding = true;

		const eventQueue = new DedupQueue<Event<unknown>>();
		const processedEvents: Set<Event<unknown>> = new Set();

		try {
			for (const source of this.#emittingSources) {
				if (!source.isActive) continue;

				eventQueue.add(source);
			}
			this.#emittingSources.clear();

			while (eventQueue.size > 0) {
				// biome-ignore lint/style/noNonNullAssertion: size checked
				const event = eventQueue.take()!;
				assert(event.isActive, "Event is not active");
				assert(!processedEvents.has(event), "Event is already processed");

				processedEvents.add(event);

				let maybeValue: Maybe<unknown>;
				try {
					maybeValue = event.getEmittedValue();
				} catch (ex) {
					console.error("Event failed", ex);
					continue;
				}
				if (!maybeValue) continue;

				const value = maybeValue();

				for (const childEvent of event.childEvents) {
					pushEventToQueue(childEvent);
				}

				for (const state of event.dependenedStates) {
					state.prepareUpdate();

					for (const behavior of collectAllDependentBehaviors(
						state.dependedBehaviors,
					)) {
						pushEventToQueue(behavior.updated);
					}
				}

				for (const [runEffect, effectEvent] of event.effects) {
					try {
						this.#isRunningEffect = true;
						const result = runEffect(value);

						if (!effectEvent.isActive) continue;
						effectEvent.emit(result);

						eventQueue.add(effectEvent);
					} catch (ex) {
						console.warn("Effect failed", ex);
					} finally {
						this.#isRunningEffect = false;
					}
				}
			}

			for (const node of this.#toCommitNodes) {
				node.commit();
			}
			this.#toCommitNodes.clear();
		} finally {
			this.#isProceeding = false;
		}

		this.#timestamp = this.nextTimestamp;

		function pushEventToQueue(event: Event<unknown>) {
			if (eventQueue.has(event)) return;
			if (processedEvents.has(event)) return;

			eventQueue.add(event);
		}

		function* collectAllDependentBehaviors(
			behaviors: Iterable<DerivedBehavior<unknown>>,
		): IterableIterator<DerivedBehavior<unknown>> {
			for (const behavior of behaviors) {
				assert(behavior.updated.isActive, "Behavior is not active");

				yield behavior;
				yield* collectAllDependentBehaviors(behavior.dependedBehaviors);
			}
		}
	}

	#emittingSources = new Set<Source<unknown>>();

	// @internal
	markEmitting(event: Source<unknown>) {
		this.#emittingSources.add(event);
	}

	#readTrackings: Set<Behavior<any>>[] = [];

	// @internal
	reportRead(behavior: Behavior<any>) {
		this.#readTrackings.at(-1)?.add(behavior);
	}

	// @internal
	withTrackingRead<T>(
		fn: () => T,
	): readonly [value: T, dependencies: Set<Behavior<any>>] {
		this.#readTrackings.push(new Set());

		let value: T;
		let dependencies: Set<Behavior<any>>;
		try {
			value = fn();
		} finally {
			// biome-ignore lint/style/noNonNullAssertion: pop the last read trackings that was pushed above
			dependencies = this.#readTrackings.pop()!;
		}

		return [value, dependencies] as const;
	}

	get isTracking() {
		return this.#readTrackings.length > 0;
	}

	// @internal
	withReadingNextValue<U>(fn: () => U): U {
		this.#isReadingNextValue = true;

		try {
			return fn();
		} finally {
			this.#isReadingNextValue = false;
		}
	}

	#toCommitNodes: Set<Node> = new Set();

	// @internal
	needCommit(node: Node) {
		this.#toCommitNodes.add(node);
	}
}
