import type { Event } from "../event/Event";
import { Node } from "../Node";
import type { TopoNode } from "../utils/IncrementalTopo";
import type { ComputedDynamic } from "./ComputedDynamic";
import type { State } from "./State";

export abstract class Dynamic<T> extends Node {
	// biome-ignore lint/suspicious/noExplicitAny: to satisfy covariance
	dependedDynamics: Set<ComputedDynamic<any>> = new Set();
	abstract updated: Event<T>;

	abstract readCurrent(): T;
	abstract readNext(): { value: T; isUpdated: boolean };

	on<U>(fn: (value: T) => U): readonly [state: State<U>, dispose: () => void] {
		const [effectfulUpdateEvent, dispose] = this.updated.on(fn);

		return [
			this.timeline.state(fn(this.readCurrent()), effectfulUpdateEvent),
			dispose,
		];
	}

	*[Symbol.iterator](): Generator<Dynamic<T>, T> {
		return yield this;
	}

	*outgoings(): Iterable<TopoNode> {
		yield* this.dependedDynamics;
	}

	read() {
		return this.readCurrent();
	}
}
