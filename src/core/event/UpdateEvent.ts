import { just } from "../../utils/Maybe";
import type { ComputedBehavior } from "../behavior/ComputedBehavior";
import type { Metadata } from "../Node";
import { Event } from "./Event";

export class UpdateEvent<T> extends Event<T> {
	constructor(
		public computed: ComputedBehavior<T>,
		metadata?: Metadata,
	) {
		super(computed.timeline, metadata);
	}

	getEmittedValue() {
		const { value, isUpdated } = this.computed.readNextValue();
		if (!isUpdated) return;

		return just(value);
	}

	activate(): void {
		this.computed.activate();
	}

	deactivate(): void {
		this.computed.deactivate();
	}
}
