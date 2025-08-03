import assert from "assert";
import { Emmittable } from "./Event";

export class Source<T> extends Emmittable<T> {
	emit = (value: T) => {
		const { timeline } = this;
		assert(!timeline.isProceeding, "Timeline is proceeding");

		if (this.maybeLastEmitedValue) {
			// TODO: warn
			timeline.proceed();
		}

		// Call parent emit method
		super.emit(value);

		timeline.reportEmission(this as Source<unknown>);
	};
}
