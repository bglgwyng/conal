import { just, type Maybe } from "../../utils/Maybe";
import type { Event } from "../event/Event";
import type { Node } from "../Node";
import type { Timeline } from "../Timeline";
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

		updated.withActivation(() => {
			updated.dependedDynamics.add(this);
			this.timeline.reorder(updated, this);

			return () => {
				updated.dependedDynamics.delete(this);
			};
		});
	}

	*incomings() {
		yield this.updated;
	}

	*outgoings() {
		yield* this.dependedDynamics;
	}

	readCurrent(): T {
		if (this.memoized) return this.memoized();

		const current = this.#read();
		this.memoized = just(current);

		return current;
	}

	*proceed(): Iterable<Node> {}

	commit() {
		this.memoized = undefined;
	}
}
