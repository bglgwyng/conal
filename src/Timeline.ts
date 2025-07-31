import assert from "assert";
import type { Behavior } from "./behavior/Behavior";
import type { DerivedBehavior } from "./behavior/DerivedBehavior";
import { State } from "./behavior/State";
import type { Event } from "./event/Event";
import { Never } from "./event/Never";
import { Source } from "./event/Source";
import type { Node } from "./Node";
import { affine } from "./utils/affine";
import { DedupQueue } from "./utils/DedupQueue";

export class Timeline {
	timestamp = 0;

	emittingSources = new Set<Source<unknown>>();

	isProceeding = false;
	isTracking = false;
	isReadingNextValue = false;

	hasStarted = false;
	isRunningEffect = true;

	start() {
		assert(!this.hasStarted, "Timeline has already started");

		this.hasStarted = true;
		this.isRunningEffect = false;
	}

	get canUpdateNetwork() {
		return this.isRunningEffect || !this.hasStarted;
	}

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
		assert(this.hasStarted, "Timeline has not started");
		assert(!this.isProceeding, "Timeline is already proceeding");

		this.isProceeding = true;

		const eventQueue = new DedupQueue<Event<unknown>>();
		const processedEvents: Set<Event<unknown>> = new Set();

		try {
			for (const source of this.emittingSources) {
				if (!source.isActive) continue;

				eventQueue.add(source);
			}
			this.emittingSources.clear();

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

					for (const behavior of collectAllDependentBehaviors(
						state.dependedBehaviors,
					)) {
						pushEventToQueue(behavior.updated);
					}
				}

				for (const [runEffect, effectEvent] of event.effects) {
					try {
						this.isRunningEffect = true;
						const result = runEffect(value);

						if (!effectEvent.isActive) continue;
						effectEvent.emit(result);

						eventQueue.add(effectEvent);
					} catch (ex) {
						console.warn("Effect failed", ex);
					} finally {
						this.isRunningEffect = false;
					}
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

		return affine(() => {
			// biome-ignore lint/style/noNonNullAssertion: pop the set that was pushed above
			const dependencies = this.reads.pop()!;
			if (this.reads.length === 0) this.isTracking = false;

			return dependencies;
		});
	}

	withReadingNextValue<U>(fn: () => U): U {
		this.isReadingNextValue = true;

		try {
			return fn();
		} finally {
			this.isReadingNextValue = false;
		}
	}

	startAdjusting() {
		this.isRunningEffect = true;

		return affine(() => {
			this.isRunningEffect = false;
		});
	}

	get nextTimestamp() {
		return this.timestamp + 1;
	}

	toCommitNodes: Set<Node> = new Set();
	needCommit(node: Node) {
		this.toCommitNodes.add(node);
	}

	never = new Never<any>(this);
}
