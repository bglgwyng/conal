import { Node } from "./Node";
import type { Timeline } from "./Timeline";
export abstract class ReactiveNode extends Node {
	constructor(public readonly timeline: Timeline) {
    super();
  }

	commit(nextTimestamp: number) {}
}
