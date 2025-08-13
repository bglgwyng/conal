import type { Maybe } from "../../utils/Maybe";
import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import type { TopoNode } from "../utils/IncrementalTopo";
import { Dynamic } from "./Dynamic";

export class State<T> extends Dynamic<T> {
	public value: T;
	public maybeNextValue: Maybe<T>;

	constructor(
		timeline: Timeline,
		initialValue: T,
		public updated: Event<T>,
	) {
		super(timeline);

		this.value = initialValue;
		this.updated.writeOn(this);
	}

	incoming(): Iterable<TopoNode> {
		return [this.updated];
	}

	readCurrent(): T {
		return this.value;
	}

	prepareUpdate() {
		this.maybeNextValue = this.updated.getEmission();
		this.timeline.needCommit(this);
	}

	commit(): void {
		const { maybeNextValue } = this;
		if (!maybeNextValue) return;

		this.value = maybeNextValue();
		this.maybeNextValue = undefined;
	}
}
