import { Node } from "../Node";
import type { ComputedDynamic } from "./ComputedDynamic";

export abstract class Behavior<T> extends Node {
	dependedDynamics: Set<ComputedDynamic<any>> = new Set();

	read = (): T => {
		const { timeline } = this;
		timeline.reportRead(this);

		return timeline.isReadingNextValue
			? this.readNextValue().value
			: this.readCurrentValue();
	};

	abstract readCurrentValue(): T;
	abstract readNextValue(): { value: T; isUpdated: boolean };
}
