import type { Timeline } from "../Timeline";

export abstract class Node {
	_tag?: string;
	constructor(public timeline: Timeline) {}

	commit() {}

	tag(tag: string) {
		this._tag = tag;
	}
}
