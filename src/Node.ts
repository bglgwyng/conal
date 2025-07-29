import type { Timeline } from "./Timeline";

export abstract class Node {
	constructor(public timeline: Timeline) {}

	commit() {}
}
