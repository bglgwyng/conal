import { just } from "../../utils/Maybe";
import type { ComputedBehavior } from "../behavior/ComputedBehavior";
import { Event } from "./Event";

export class UpdateEvent<T> extends Event<T> {
	constructor(public computed: ComputedBehavior<T>) {
		super(computed.timeline);
	}

	getEmission() {
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
