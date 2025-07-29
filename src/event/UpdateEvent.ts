import type { DerivedBehavior } from "../behavior/DerivedBehavior";
import { Event } from "./Event";

export class UpdateEvent<T> extends Event<T> {
	constructor(
		public derivedBehavior: DerivedBehavior<T>,
		options?: { debugLabel?: string },
	) {
		super(derivedBehavior.timeline, options);
	}

	takeEmittedValue(): (() => T) | undefined {
		const { value, isUpdated } = this.derivedBehavior.readNextValue();
		if (!isUpdated) return;

		return () => value;
	}
}
