import type { Maybe } from "../../utils/Maybe";
import type { Dynamic } from "../dynamic/Dynamic";
import type { Timeline } from "../Timeline";
import type { TopoNode } from "../utils/IncrementalTopo";
import { Event } from "./Event";

export class SwitchingEvent<U, T> extends Event<T> {
	constructor(
		timeline: Timeline,
		public readonly dynamic: Dynamic<U>,
		public readonly extractEvent: (dynamic: U) => Event<T>,
	) {
		super(timeline);
	}

	getEmission(): Maybe<T> {
		return this.extractEvent(this.dynamic.readCurrent()).getEmission();
	}

	incoming(): Iterable<TopoNode> {
		return [this.dynamic, this.extractEvent(this.dynamic.readCurrent())];
	}

	activate(): void {
		this.dispose = this.listen(this.extractEvent(this.dynamic.readCurrent()));
		[, this.disposeDynamicUpdated] = this.dynamic.updated.on((event) => {
			// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
			this.dispose!();
			this.dispose = this.listen(this.extractEvent(event));
		});
	}

	deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.dispose!();
		this.dispose = undefined;

		// biome-ignore lint/style/noNonNullAssertion: `disposeDynamicUpdated` is set in activate
		this.disposeDynamicUpdated!();
		this.disposeDynamicUpdated = undefined;
	}

	dispose?: () => void;
	disposeDynamicUpdated?: () => void;
}
