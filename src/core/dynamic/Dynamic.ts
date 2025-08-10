import type { Event } from "../event/Event";
import { Behavior } from "./Behavior";
import type { ComputedDynamic } from "./ComputedDynamic";
import type { State } from "./State";

export abstract class Dynamic<T> extends Behavior<T> {
	dependedDynamics: Set<ComputedDynamic<any>> = new Set();
	abstract updated: Event<T>;

	on<U>(fn: (value: T) => U): readonly [state: State<U>, dispose: () => void] {
		const [effectfulUpdateEvent, dispose] = this.updated.on(fn);

		return [
			this.timeline.state(fn(this.readCurrent()), effectfulUpdateEvent),
			dispose,
		];
	}

	abstract readNext(): { value: T; isUpdated: boolean };
}
