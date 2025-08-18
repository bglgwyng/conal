import type { Maybe } from "../../utils/Maybe";
import type { Dynamic } from "../dynamic/Dynamic";
import type { Timeline } from "../Timeline";
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

	incomings() {
		return [this.dynamic, this.extractEvent(this.dynamic.readCurrent())];
	}

	activate(): void {
		[, this.disposeDynamicUpdated] = this.dynamic.updated.on((event) => {
			// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
			this.dispose!();

			const activeEvent = this.extractEvent(event);
			this.dispose = this.listen(activeEvent);
			this.timeline.reorder(activeEvent, this);
		});

		// TODO: use `safeEstablishEdge`
		const activeEvent = this.extractEvent(this.dynamic.readCurrent());
		this.dispose = this.listen(activeEvent);
		this.timeline.reorder(activeEvent, this);
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
