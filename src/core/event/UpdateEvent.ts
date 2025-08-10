import { just } from "../../utils/Maybe";
import type { ComputedDynamic } from "../dynamic/ComputedDynamic";
import { Event } from "./Event";

export class UpdateEvent<T> extends Event<T> {
	constructor(public computed: ComputedDynamic<T>) {
		super(computed.timeline);
	}

	getEmission() {
		const { value, isUpdated } = this.computed.readNext();
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
