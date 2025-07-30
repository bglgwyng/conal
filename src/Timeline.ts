import assert from "assert";
import type { Behavior } from "./behavior/Behavior";
import type { DerivedBehavior } from "./behavior/DerivedBehavior";
import { State } from "./behavior/State";
import type { Effect } from "./event/Effect";
import type { Event } from "./event/Event";
import { Never } from "./event/never";
import { Source } from "./event/Source";
import type { Node } from "./Node";
import { DedupQueue } from "./utils/DedupQueue";

export class Timeline {
	timestamp = 0;

	emittingSources = new Set<Source<unknown>>();

	isProceeding = false;
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
		this.isProceeding = true;

		const eventQueue = new DedupQueue<Event<unknown>>();
		const processedEvents: Set<Event<unknown>> = new Set();

		try {
			for (const source of this.emittingSources) {
				if (!source.isActive) continue;

				eventQueue.add(source);
			}
			this.emittingSources.clear();

			const pendingEffects: Effect[] = [];

			while (eventQueue.size > 0) {
				// biome-ignore lint/style/noNonNullAssertion: size checked
				const event = eventQueue.take()!;
				assert(event.isActive, "Event is not active");
				assert(!processedEvents.has(event), "Event is already processed");

				processedEvents.add(event);

				const maybeValue = event.takeEmittedValue();
				if (!maybeValue) continue;

				const value = maybeValue();

				for (const childEvent of event.childEvents) {
					pushEventToQueue(childEvent);
				}

				for (const state of event.dependenedStates) {
					state.prepareUpdate();

					for (const behavior of collectAllDependentActiveBehaviors(
						state.dependedBehaviors,
					)) {
						pushEventToQueue(behavior.updated);
					}
				}

				for (const effect of event.effects) {
					pendingEffects.push(() => effect(value));
				}
			}

			for (const effect of pendingEffects) {
				try {
					effect();
				} catch (ex) {
					console.error("Effect failed", ex);
				}
			}

			for (const node of this.toCommitNodes) {
				node.commit();
			}
			this.toCommitNodes.clear();
		} finally {
			this.isProceeding = false;
		}

		this.timestamp = this.nextTimestamp;

		function pushEventToQueue(event: Event<unknown>) {
			if (eventQueue.has(event)) return;
			if (processedEvents.has(event)) return;

			eventQueue.add(event);
		}

		function* collectAllDependentActiveBehaviors(
			behaviors: Iterable<DerivedBehavior<unknown>>,
		): IterableIterator<DerivedBehavior<unknown>> {
			for (const behavior of behaviors) {
				if (!behavior.updated.isActive) continue;

				yield behavior;
				yield* collectAllDependentActiveBehaviors(behavior.dependedBehaviors);
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

	toCommitNodes: Set<Node> = new Set();
	needCommit(node: Node) {
		this.toCommitNodes.add(node);
	}

	never = new Never(this);
}
