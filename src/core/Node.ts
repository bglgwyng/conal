import type { Timeline } from "../Timeline";

export abstract class Node {
	constructor(
		public timeline: Timeline,
		public metadata?: Metadata,
	) {}

	commit() {}
}

export type Metadata = {
	debugLabel?: string;
};
