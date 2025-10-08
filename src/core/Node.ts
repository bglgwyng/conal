import assert from "node:assert";
import type { Timeline } from "./Timeline";
import type { TopoNode } from "./utils/IncrementalTopo";

export abstract class Node implements TopoNode {
	constructor(public readonly timeline: Timeline) {
		this.timeline.topo.addNode(this);
	}

	rank = 0;

	commit(_nextTimestamp: number) {}

	proceedState = ProceedState.Idle;
	pendingProceed?: Iterator<ProceedEffect>;
	pendingNodes = new Set<Node>();
	abstract proceed(): Iterable<ProceedEffect>;

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

export enum ProceedState {
	Idle = "Idle",
	Queued = "Queued",
	Done = "Done",
	Pending = "Pending",
}

export function* wait(node: Node): Generator<WaitEffect, void, void> {
	yield ["wait", node];
}

export function* propagate(node: Node): Generator<PropagateEffect, void, void> {
	yield ["propagate", node];
}

export type PropagateEffect = readonly ["propagate", Node];
export type WaitEffect = readonly ["wait", Node];
export type ProceedEffect = PropagateEffect | WaitEffect;
