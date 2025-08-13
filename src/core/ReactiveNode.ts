import type { Timeline } from "./Timeline";

export abstract class ReactiveNode {
	_tag?: string;
	constructor(public timeline: Timeline) {}

	commit(nextTimestamp: number) {}

	tag(tag: string): this {
		this._tag = tag;
		return this;
	}
}
