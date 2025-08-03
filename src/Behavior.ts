import type { Behavior as InternalBehavior } from "./core/behavior/Behavior";
import { withTimeline } from "./GlobalContext";

export class Behavior<T> {
	// @internal
	internal: InternalBehavior<T>;

	constructor(internalBehavior: InternalBehavior<T>) {
		this.internal = internalBehavior;
	}

	read = (): T => withTimeline(this.internal.timeline, this.internal.read);

	on<U>(fn: (value: T) => U): readonly [Behavior<U>, () => void] {
		const [effectEvent, dispose] = this.internal.on((value) =>
			withTimeline(this.internal.timeline, () => fn(value)),
		);

		return [new Behavior(effectEvent), dispose];
	}
}
