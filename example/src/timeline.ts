import { proceedImmediately, Timeline } from "@conaljs/conal";

export const t = new Timeline({
	onSourceEmission: proceedImmediately,
});
