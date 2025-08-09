import type { Event } from "../event/Event";
import { Node } from "../Node";
import type { ComputedDynamic } from "./ComputedDynamic";
import type { State } from "./State";

export abstract class Dynamic<T> extends Node {
	dependedDynamics: Set<ComputedDynamic<any>> = new Set();

	read = (): T => {
		const { timeline } = this;
		timeline.reportRead(this);

		return timeline.isReadingNextValue
			? this.readNextValue().value
			: this.readCurrentValue();
	};

	abstract updated: Event<T>;

	adjustOn<U>(
		fn: (value: T) => U,
	): readonly [state: State<U>, dispose: () => void] {
		const [effectfulUpdateEvent, dispose] = this.updated.adjustOn(fn);

		return [
			this.timeline.state(fn(this.readCurrentValue()), effectfulUpdateEvent),
			dispose,
		];
	}

	abstract readCurrentValue(): T;
	abstract readNextValue(): { value: T; isUpdated: boolean };
}
