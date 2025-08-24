import type { Event } from "@conaljs/conal";
import { useRefFactory } from "./useRefFactory";
import { t } from "../timeline";

export function useEvent<T>(): [Event<T>, (value: T) => void] {
	return useRefFactory(() => t.source<T>());
}