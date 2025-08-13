import type { Timeline } from "./Timeline";
import type { TopoNode } from "./utils/IncrementalTopo";

export abstract class Node implements TopoNode {
	constructor(public readonly timeline: Timeline) {}

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
	abstract outcomings(): Iterable<TopoNode>;

	_tag?: string;
	tag(tag: string): this {
		this._tag = tag;
		return this;
	}
}
