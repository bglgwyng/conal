import { just, type Maybe } from "../../utils/Maybe";
import type { Event } from "../event/Event";
import type { Timeline } from "../Timeline";
import type { ComputedDynamic } from "./ComputedDynamic";
import { Dynamic } from "./Dynamic";

export class UnsafeDynamic<T> extends Dynamic<T> {
	memoized: Maybe<T>;
	#read: () => T;

	constructor(
		timline: Timeline,
		read: () => T,
		readonly updated: Event<T>,
	) {
		super(timline);
		this.#read = read;
	}

	readCurrent(): T {
		if (this.memoized) return this.memoized();

		const current = this.#read();
		this.memoized = just(current);

		this.timeline.needCommit(this);

		return current;
	}

	commit() {
		this.memoized = undefined;
	}
}
