import type { ComputedDynamic } from "./core/dynamic/ComputedDynamic";
import type { Dynamic } from "./core/dynamic/Dynamic";
import { State } from "./core/dynamic/State";
import type { Event } from "./core/event/Event";
import { Never } from "./core/event/Never";
import { Source } from "./core/event/Source";
import type { Node } from "./core/Node";
import { assert } from "./utils/assert";
import { DedupQueue } from "./utils/DedupQueue";
import type { Maybe } from "./utils/Maybe";

export class Timeline {
	constructor(options: TimelineOptions) {
		this.#onSourceEmission = options.onSourceEmission;
	}

	#onSourceEmission: (event: Source<unknown>, proceed: () => void) => void;

	#timestamp = 0;
	get timestamp() {
		return this.#timestamp;
	}

	getNextTimestamp() {
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

	state<T>(initialValue: T, updated: Event<T>): State<T> {
		return new State(this, initialValue, updated);
	}

	source<T>(): Source<T> {
		return new Source(this);
	}

	never = new Never<any>(this);

	// @internal
	proceed() {
		assert(!this.#isProceeding, "Timeline is already proceeding");

		this.#isProceeding = true;

		const nextTimestamp = this.getNextTimestamp();

		const eventQueue = new DedupQueue<Event<unknown>>();
		const processedEvents: Set<Event<unknown>> = new Set();
		const effects: (() => unknown)[] = [];

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
					maybeValue = event.getEmission();
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

					for (const dynamic of collectDependendedDynamics(
						state.dependedDynamics,
					)) {
						pushEventToQueue(dynamic.updated);
					}
				}

				effects.push(...event.effects.map((f) => () => f(value)));
				for (const [runAdjustment, adjustmentEvent] of event.adjustments) {
					try {
						this.#isRunningEffect = true;
						const result = runAdjustment(value);

						if (!adjustmentEvent.isActive) continue;
						adjustmentEvent.emit(result);

						eventQueue.add(adjustmentEvent);
					} catch (ex) {
						console.warn("Effect failed", ex);
					} finally {
						this.#isRunningEffect = false;
					}
				}
			}

			for (const node of this.#toCommitNodes) {
				node.commit(nextTimestamp);
			}
			this.#toCommitNodes.clear();
		} finally {
			this.#isProceeding = false;
		}

		this.#timestamp = nextTimestamp;

		for (const runEffect of effects) {
			runEffect();
		}

		function pushEventToQueue(event: Event<unknown>) {
			if (eventQueue.has(event)) return;
			if (processedEvents.has(event)) return;

			eventQueue.add(event);
		}

		function* collectDependendedDynamics(
			dynamics: Iterable<ComputedDynamic<unknown>>,
		): IterableIterator<ComputedDynamic<unknown>> {
			for (const dynamic of dynamics) {
				assert(dynamic.updated.isActive, "Dynamic is not active");

				yield dynamic;
				yield* collectDependendedDynamics(dynamic.dependedDynamics);
			}
		}
	}

	#emittingSources = new Set<Source<unknown>>();

	// @internal
	reportEmission(event: Source<unknown>) {
		this.#emittingSources.add(event);

		this.#onSourceEmission(event, () => {
			assert(
				this.timestamp === this.#emittingSources.size,
				"Timeline has already proceeded",
			);
			assert(!this.isProceeding, "Timeline is already proceeding");
			this.proceed();
		});
	}

	#readTrackings: Set<Dynamic<any>>[] = [];

	// @internal
	reportRead(dynamic: Dynamic<any>) {
		this.#readTrackings.at(-1)?.add(dynamic);
	}

	// @internal
	withTrackingRead<T>(
		fn: () => T,
	): readonly [value: T, dependencies: Set<Dynamic<any>>] {
		this.#readTrackings.push(new Set());

		let value: T;
		let dependencies: Set<Dynamic<any>>;
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

export type TimelineOptions = {
	onSourceEmission: (event: Source<unknown>, proceed: () => void) => void;
};

export function proceedImmediately(
	_event: Source<unknown>,
	proceed: () => void,
) {
	proceed();
}
