import { assert } from "../utils/assert";
import type { Maybe } from "../utils/Maybe";
import type { ComputedDynamic } from "./dynamic/ComputedDynamic";
import { Dynamic } from "./dynamic/Dynamic";
import { State } from "./dynamic/State";
import { Event } from "./event/Event";
import { Never } from "./event/Never";
import { Source } from "./event/Source";
import type { Node } from "./Node";
import { Heap } from "./utils/Heap";
import { IncrementalTopo } from "./utils/IncrementalTopo";

export class Timeline {
	constructor(options: TimelineOptions) {
		this.#onSourceEmission = options.onSourceEmission;
	}

	topo: IncrementalTopo = new IncrementalTopo();

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

		const queue = new Heap<Node>((x, y) =>
			x.rank < y.rank ? -1 : x.rank > y.rank ? 1 : 0,
		);
		const queuedEvents: Set<Node> = new Set();
		const processedEvents: Set<Node> = new Set();
		const cleanups: ((nextTimestamp: number) => void)[] = [];

		try {
			for (const source of this.#emittingSources) {
				if (!source.isActive) continue;

				queue.push(source);
			}
			this.#emittingSources.clear();

			while (queue.size > 0) {
				// biome-ignore lint/style/noNonNullAssertion: size checked
				const node = queue.pop()!;
				queuedEvents.delete(node);

				if (node instanceof Event) {
					assert(node.isActive, "Event is not active");
					assert(!processedEvents.has(node), "Event is already processed");

					processedEvents.add(node);

					let maybeValue: Maybe<unknown>;
					try {
						maybeValue = node.getEmission();
					} catch (ex) {
						console.error("Event failed", ex);
						continue;
					}
					if (!maybeValue) continue;

					const value = maybeValue();

					for (const childEvent of node.childEvents) {
						pushToQueue(childEvent);
					}

					// TODO: run `getEmissions`s here
					for (const dynamic of node.dependenedStates) {
						// dynamic.prepareUpdate();

						pushToQueue(dynamic);

						// for (const dynamic of collectDependendedDynamics(
						// 	dynamic.dependedDynamics,
						// )) {
						// 	pushToQueue(dynamic.updated);
						// }
					}

					for (const [runEffect, effectEvent] of node.effects) {
						try {
							const result = runEffect(value);

							if (!effectEvent.isActive) continue;
							effectEvent.emit(result);

							pushToQueue(effectEvent);
							// eventQueue.push(effectEvent);
						} catch (ex) {
							console.warn("Effect failed", ex);
						}
					}
				} else if (node instanceof Dynamic) {
					if (node instanceof State) {
						const it = node.proceed();
						while (true) {
							const child = it.next();
							if (child.done) {
								if (child.value) cleanups.push(child.value);
								break;
							}
							pushToQueue(child.value);
						}
					}
					for (const child of node.outcomings()) {
						pushToQueue(child);
					}
				}
			}

			for (const cleanup of cleanups) {
				cleanup(nextTimestamp);
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

		function pushToQueue(node: Node) {
			if (queuedEvents.has(node)) return;
			if (processedEvents.has(node)) return;

			queuedEvents.add(node);
			queue.push(node);
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

	#readTrackings: Set<Dynamic<unknown>>[] = [];

	read = <T>(dynamic: Dynamic<T>) => {
		this.#readTrackings.at(-1)?.add(dynamic);

		return this.readMode === ReadMode.Current
			? dynamic.readCurrent()
			: dynamic.readNext().value;
	};

	// @internal
	withTrackingRead<T>(
		fn: () => T,
	): readonly [value: T, dependencies: Set<Dynamic<unknown>>] {
		this.#readTrackings.push(new Set());

		let value: T;
		let dependencies: Set<Dynamic<unknown>>;
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

export enum ReadMode {
	Current,
	Next,
}
