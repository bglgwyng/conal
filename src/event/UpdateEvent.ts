import type { DerivedBehavior } from "../behavior/DerivedBehavior";
import { just } from "../utils/Maybe";
import { Event } from "./Event";

export class UpdateEvent<T> extends Event<T> {
	constructor(
		public derivedBehavior: DerivedBehavior<T>,
		options?: { debugLabel?: string },
	) {
		super(derivedBehavior.timeline, options);
	}

	takeEmittedValue() {
		const { value, isUpdated } = this.derivedBehavior.readNextValue();
		if (!isUpdated) return;

		return just(value);
	}
}
