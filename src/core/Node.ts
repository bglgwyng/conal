import assert from "assert";
import type { Timeline } from "../Timeline";

export abstract class Node {
	constructor(public timeline: Timeline) {
		assert(this.timeline.canUpdateNetwork, "Cannot update network");
	}

	commit() {}
}
