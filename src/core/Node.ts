import assert from "assert";
import type { Timeline } from "./Timeline";
import type { TopoNode } from "./utils/IncrementalTopo";

export abstract class Node implements TopoNode {
	constructor(public readonly timeline: Timeline) {
		this.timeline.topo.addNode(this);
	}

	rank = 0;

	commit(nextTimestamp: number) {}

	// biome-ignore lint/correctness/useYield: will be overriden
	*proceed(): Generator<
		Node,
		((nextTimestamp: number) => unknown) | undefined
	> {
		return;
	}

	abstract incomings(): Iterable<TopoNode>;
	abstract outgoings(): Iterable<TopoNode>;

	_tag?: string;
	getTag(): string | undefined {
		return this._tag;
	}

	setTag(tag: string): this {
		this._tag = tag;
		return this;
	}

	safeEstablishEdge(fn: () => void, newIncomings: Iterable<Node>) {
		fn();

		const updatedIncomings = new Set(this.incomings());
		for (const incoming of newIncomings) {
			assert(updatedIncomings.has(incoming), "Incoming node is not added");
			assert(incoming.rank < this.rank, "Incoming node is not well-ordered");

			assert(
				new Set(incoming.outgoings()).has(this),
				"Outgoing node is not added",
			);
		}
	}
}
