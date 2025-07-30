import assert from "assert";
import { Event } from "./Event";

export abstract class TransformEvent<T> extends Event<T> {
	get isActive() {
		return (
			this.effects.length > 0 ||
			this.dependenedStates.size > 0 ||
			this.childEvents.size > 0
		);
	}

	protected activate(): void {}
	protected deactivate(): void {}

	listen(event: Event<any>): () => void {
		assert(this.isActive, "Event is not active");

		const { isActive } = event;
		event.childEvents.add(this);

		if (!isActive) event.activate();

		return () => {
			event.childEvents.delete(this);

			if (event.isActive) event.deactivate();
		};
	}

	on(fn: (value: T) => unknown): () => void {
		const { isActive } = this;

		this.effects.push(fn);
		if (!isActive) this.activate();

		return () => {
			this.effects.splice(this.effects.indexOf(fn), 1);

			if (!this.isActive) this.deactivate();
		};
	}
}
