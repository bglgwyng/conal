import type { Event } from "../event/Event";
import { ReactiveNode } from "../ReactiveNode";
import type { ComputedDynamic } from "./ComputedDynamic";
import type { State } from "./State";

export abstract class Dynamic<T> extends ReactiveNode {
	dependedDynamics: Set<ComputedDynamic<any>> = new Set();
	abstract updated: Event<T>;

	abstract readCurrent(): T;

	on<U>(fn: (value: T) => U): readonly [state: State<U>, dispose: () => void] {
		const [effectfulUpdateEvent, dispose] = this.updated.on(fn);

		return [
			this.timeline.state(fn(this.readCurrent()), effectfulUpdateEvent),
			dispose,
		];
	}
	read() {
		return this.timeline.read(this);
	}

	readNext(): { value: T; isUpdated: boolean } {
		const maybeEmission = this.updated.getEmission();

		return maybeEmission
			? { value: maybeEmission(), isUpdated: true }
			: { value: this.readCurrent(), isUpdated: false };
	}
}
