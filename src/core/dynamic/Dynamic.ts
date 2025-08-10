import type { Event } from "../event/Event";
import { Behavior } from "./Behavior";
import type { State } from "./State";

export abstract class Dynamic<T> extends Behavior<T> {
	abstract updated: Event<T>;

	on<U>(fn: (value: T) => U): readonly [state: State<U>, dispose: () => void] {
		const [effectfulUpdateEvent, dispose] = this.updated.on(fn);

		return [
			this.timeline.state(fn(this.readCurrentValue()), effectfulUpdateEvent),
			dispose,
		];
	}
}
