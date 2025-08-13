import type { Timeline } from "./Timeline";
import { TopoNode } from "./utils/IncrementalTopo";

export abstract class ReactiveNode extends TopoNode {
	constructor(public readonly timeline: Timeline) {
    super();
  }

	commit(nextTimestamp: number) {}
}
