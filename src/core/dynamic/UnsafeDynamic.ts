import type { Timeline } from "../../Timeline";
import type { Event } from "../event/Event";
import type { ComputedDynamic } from "./ComputedDynamic";
import { Dynamic } from "./Dynamic";

export class UnsafeDynamic<T> extends Dynamic<T> {
	dependedDynamics: Set<ComputedDynamic<any>> = new Set();

	constructor(
		timline: Timeline,
		readonly readCurrent: () => T,
		readonly updated: Event<T>,
	) {
		super(timline);
	}
}
