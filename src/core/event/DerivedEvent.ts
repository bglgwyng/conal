import { just, type Maybe } from "../../utils/Maybe";
import { Event } from "./Event";

export abstract class DerivedEvent<T> extends Event<T> {
	#lastEmission: Maybe<Maybe<T>>;
	abstract deriveEmission(): Maybe<T>;

	getEmission() {
		const lastEmission = this.#lastEmission;
		if (lastEmission) return lastEmission();

		const emission = this.deriveEmission();
		this.#lastEmission = just(emission);

		return emission;
	}

	commit(_nextTimestamp: number): void {
		this.#lastEmission = undefined;
	}
}
