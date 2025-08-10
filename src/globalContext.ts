import type { Timeline } from "./Timeline";
import { assert } from "./utils/assert";

const globalContext = {
	activeTimeline: undefined as Timeline | undefined,
};

export function getActiveTimeline() {
	const { activeTimeline } = globalContext;
	assert(activeTimeline, "Timeline is not active");

	return activeTimeline;
}

export function useTimeline(timeline: Timeline): Disposable {
	const previousTimeline = globalContext.activeTimeline;

	globalContext.activeTimeline = timeline;
	return {
		[Symbol.dispose]: () => {
			globalContext.activeTimeline = previousTimeline;
		},
	};
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

export function queueTaskAfterProceed(fn: () => void) {
	getActiveTimeline().queueTaskAfterProceed(fn);
}
