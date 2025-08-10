import { proceedImmediately, Timeline } from "conal";

export const t = new Timeline({
	onSourceEmission: proceedImmediately,
});
