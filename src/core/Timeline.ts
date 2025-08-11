import { assert } from "../utils/assert";
import { DedupQueue } from "../utils/DedupQueue";
import type { Maybe } from "../utils/Maybe";
import type { ComputedDynamic } from "./dynamic/ComputedDynamic";
import type { Dynamic } from "./dynamic/Dynamic";
import { State } from "./dynamic/State";
import type { Event } from "./event/Event";
import { Never } from "./event/Never";
import { Source } from "./event/Source";
import type { Node } from "./Node";

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

				// TODO: run `getEmissions`s here
				for (const state of event.dependenedStates) {
					state.prepareUpdate();

					for (const dynamic of collectDependendedDynamics(
						state.dependedDynamics,
					)) {
						pushEventToQueue(dynamic.updated);
					}
				}

				for (const [runEffect, effectEvent] of event.effects) {
					try {
						const result = runEffect(value);

						if (!effectEvent.isActive) continue;
						effectEvent.emit(result);

						eventQueue.add(effectEvent);
					} catch (ex) {
						console.warn("Effect failed", ex);
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

		for (const fn of this.#tasksAfterProceed) {
			fn();
		}
		this.#tasksAfterProceed = [];

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

		const { timestamp } = this;
		this.#onSourceEmission(event, () => {
			assert(timestamp === this.timestamp, "Timeline has already proceeded");
			assert(!this.isProceeding, "Timeline is already proceeding");
			this.proceed();
		});
	}

	#readTrackings: Set<Dynamic<any>>[] = [];

	read = <T>(dynamic: Dynamic<T>) => {
		this.#readTrackings.at(-1)?.add(dynamic);

		return this.readMode === ReadMode.Current
			? dynamic.readCurrent()
			: dynamic.readNext().value;
	};

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

	#readMode = ReadMode.Current;
	get readMode() {
		return this.#readMode;
	}

	withReadMode<U>(mode: ReadMode, fn: () => U): U {
		const previousReadingNextValue = this.#readMode;
		this.#readMode = mode;

		try {
			return fn();
		} finally {
			this.#readMode = previousReadingNextValue;
		}
	}

	#toCommitNodes: Set<Node> = new Set();

	// @internal
	needCommit(node: Node) {
		this.#toCommitNodes.add(node);
	}

	#tasksAfterProceed: (() => void)[] = [];
	// @internal
	queueTaskAfterProceed(fn: () => void) {
		assert(this.#isProceeding, "Timeline is not proceeding");
		this.#tasksAfterProceed.push(fn);
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

export enum ReadMode {
	Current,
	Next,
}
