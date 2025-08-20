import assert from "assert";
import { just, type Maybe } from "../../utils/Maybe";
import type { Dynamic } from "../dynamic/Dynamic";
import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class SwitchingEvent<U, T> extends Event<T> {
	#activeEmission: Maybe<T>;
	#activeEvent?: Event<T>;
	#nextActiveEvent?: Event<T>;

	constructor(
		timeline: Timeline,
		public readonly dynamic: Dynamic<U>,
		public readonly extractEvent: (dynamic: U) => Event<T>,
	) {
		super(timeline);
	}

	getEmission(): Maybe<T> {
		return this.#activeEmission;
	}

	*incomings() {
		yield this.dynamic.updated;

		// biome-ignore lint/style/noNonNullAssertion: `incomings` is always called after `activate`
		yield this.#activeEvent!;
	}

	activate(): void {
		this.#activeEvent = this.extractEvent(this.dynamic.readCurrent());

		this.#disposeSwitch = this.listen(this.dynamic.updated, (event) => {
			this.#nextActiveEvent = this.extractEvent(event);
		});

		const activeEvent = this.#activeEvent;
		this.#dispose = this.listen(activeEvent, (value) => {
			this.#activeEmission = just(value);
		});
	}

	deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.#dispose!();
		this.#dispose = undefined;

		this.#disposeSwitch!();
		this.#disposeSwitch = undefined;

		this.#activeEmission = undefined;
	}

	commit(_nextTimestamp: number): void {
		this.#activeEmission = undefined;

		if (!this.#nextActiveEvent) return;

		this.#activeEvent = this.#nextActiveEvent;

		this.#dispose!();
		this.#dispose = this.listen(this.#activeEvent, (value) => {
			this.#activeEmission = just(value);
		});

		this.#nextActiveEvent = undefined;
	}

	#dispose?: () => void;
	#disposeSwitch?: () => void;
}
