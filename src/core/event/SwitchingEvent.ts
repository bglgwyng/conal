import { just, type Maybe } from "../../utils/Maybe";
import type { Dynamic } from "../dynamic/Dynamic";
import type { Timeline } from "../Timeline";
import { Event } from "./Event";

export class SwitchingEvent<U, T> extends Event<T> {
	#activeEmission: Maybe<T>;
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

	incomings() {
		return [
			this.dynamic.updated,
			this.extractEvent(this.dynamic.readCurrent()),
		];
	}

	activate(): void {
		this.listen(this.dynamic.updated, (event) => {
			this.#nextActiveEvent = this.extractEvent(event);
		});

		// TODO: use `safeEstablishEdge`
		const activeEvent = this.extractEvent(this.dynamic.readCurrent());
		this.#dispose = this.listen(activeEvent, (value) => {
			this.#activeEmission = just(value);
		});
	}

	deactivate(): void {
		// biome-ignore lint/style/noNonNullAssertion: `dispose` is set in activate
		this.#dispose!();
		this.#dispose = undefined;
	}

	commit(_nextTimestamp: number): void {
		if (!this.#nextActiveEvent) return;

		this.#dispose!();
		this.#dispose = this.listen(this.#nextActiveEvent, (value) => {
			this.#activeEmission = just(value);
		});
	}

	#dispose?: () => void;
}
