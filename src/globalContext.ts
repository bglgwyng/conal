import assert from "assert";
import type { Timeline } from "./Timeline";

const globalContext = {
	activeTimeline: undefined as Timeline | undefined,
};

export function getActiveTimeline() {
	const { activeTimeline } = globalContext;
	assert(activeTimeline, "Timeline is not active");

	return activeTimeline;
}

export function withTimeline<T>(timeline: Timeline, fn: () => T): T {
	const previousTimeline = globalContext.activeTimeline;

	globalContext.activeTimeline = timeline;
	try {
		return fn();
	} finally {
		globalContext.activeTimeline = previousTimeline;
	}
}
