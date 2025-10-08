import { assert } from "../utils/assert";
import { State } from "./dynamic/State";
import { Event } from "./event/Event";
import { Never } from "./event/Never";
import { Source } from "./event/Source";
import { type Node, ProceedState } from "./Node";
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

	never = new Never<never>(this);

	// @internal
	proceed() {
		assert(!this.#isProceeding, "Timeline is already proceeding");

		this.#isProceeding = true;

		const nextTimestamp = this.getNextTimestamp();

		const queue = new Heap<Node>((x, y) =>
			x.rank < y.rank ? -1 : x.rank > y.rank ? 1 : 0,
		);

		try {
			for (const source of this.#emittingSources) {
				if (!source.isActive) continue;

				queue.push(source);
				source.proceedState = ProceedState.Queued;
			}

			this.#emittingSources.clear();

			const processedNodes = [];
			// TODO: remove
			const everPendeds = new Set<Node>();

			while (queue.size > 0) {
				// biome-ignore lint/style/noNonNullAssertion: size checked
				const node = queue.pop()!;

				assert(
					node.proceedState === ProceedState.Queued,
					`Node(${node.getTag()}) is in wrong proceed state ${node.proceedState}`,
				);

				const it = node.pendingProceed ?? node.proceed()[Symbol.iterator]();

				while (true) {
					const { value: effect, done } = it.next();
					if (done) {
						everPendeds.delete(node);

						node.pendingProceed = undefined;
						node.proceedState = ProceedState.Done;

						processedNodes.push(node);

						for (const pendingNode of node.pendingNodes) {
							assert(
								pendingNode.proceedState === ProceedState.Pending,
								`Node(${pendingNode.getTag()}) is in wrong proceed state ${pendingNode.proceedState}`,
							);
							queue.push(pendingNode);
							pendingNode.proceedState = ProceedState.Queued;
						}
						node.pendingNodes.clear();

						break;
					}

					if (effect[0] === "propagate") {
						pushToQueue(effect[1]);
					} else {
						assert(effect[0] === "wait", "Unknown effect");
						const [, toWaitNode] = effect;
						if (toWaitNode.proceedState === ProceedState.Done) {
							// do nothing
						} else {
							everPendeds.add(node);

							node.proceedState = ProceedState.Pending;
							node.pendingProceed = it;

							toWaitNode.pendingNodes.add(node);

							pushToQueue(toWaitNode);

							break;
						}
					}
				}
			}

			assert(everPendeds.size === 0, "There are nodes that are still pending");

			for (const node of processedNodes) {
				node.commit(nextTimestamp);
				node.proceedState = ProceedState.Idle;
			}
		} finally {
			this.#isProceeding = false;
		}

		this.#timestamp = nextTimestamp;

		for (const fn of this.#tasksAfterProceed) {
			fn();
		}
		this.#tasksAfterProceed = [];

		function pushToQueue(node: Node) {
			if (node.proceedState === ProceedState.Queued) return;
			if (node.proceedState === ProceedState.Pending) return;

			queue.push(node);
			node.proceedState = ProceedState.Queued;
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

	#tasksAfterProceed: (() => void)[] = [];
	// @internal
	queueTaskAfterProceed(fn: () => void) {
		assert(this.#isProceeding, "Timeline is not proceeding");
		this.#tasksAfterProceed.push(fn);
	}

	getNodeByTag(tag: string) {
		for (const node of this.topo.nodes) {
			if (node._tag === tag) return node;
		}
	}

	reorder(u: Node, v: Node) {
		if (u instanceof Event) assert(u.isActive, "Event is not active");
		if (v instanceof Event) assert(v.isActive, "Event is not active");

		// TODO: remove this
		assert(
			new Set(u.outgoings()).has(v),
			`Node(${u.getTag()}) is not Node(${v.getTag()})'s outgoing node`,
		);
		assert(
			new Set(v.incomings()).has(u),
			`Node(${u.getTag()}) is not Node(${v.getTag()})'s incoming node`,
		);

		this.topo.reorder(u, v);
	}
}

export type TimelineOptions = {
	onSourceEmission: (event: Source<unknown>, proceed: () => void) => void;
};

export enum ReadMode {
	Current,
	Next,
}
