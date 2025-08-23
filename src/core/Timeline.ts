import { assert } from "../utils/assert";
import type { Dynamic } from "./dynamic/Dynamic";
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

			while (queue.size > 0) {
				// biome-ignore lint/style/noNonNullAssertion: size checked
				const node = queue.pop()!;
				processedNodes.push(node);

				assert(
					node.proceedState === ProceedState.Queued,
					`Node(${node.getTag()}) is in wrong proceed state ${node.proceedState}`,
				);

				for (const childNode of node.proceed()) {
					pushToQueue(childNode);
				}
				node.proceedState = ProceedState.Done;
			}

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

			assert(node.proceedState === ProceedState.Idle, "Node is not idle");

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

	read = <T>(dynamic: Dynamic<T>) => {
		return this.readMode === ReadMode.Current
			? dynamic.readCurrent()
			: dynamic.readNext().value;
	};

	withTrackingRead<T>(
		fn: () => Generator<Dynamic<unknown>, T>,
	): readonly [value: T, dependencies: Dynamic<unknown>[]] {
		const reads: Dynamic<unknown>[] = [];
		const readSet = new Set<Dynamic<unknown>>();

		const it = fn();
		let value: unknown;
		while (true) {
			const next = it.next(value);
			if (next.done) return [next.value, reads];

			if (!readSet.has(next.value)) {
				reads.push(next.value);
				readSet.add(next.value);
			}

			value = next.value.read();
		}
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
