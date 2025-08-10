import type { Dynamic } from "conal";
import { useCallback, useSyncExternalStore } from "react";

export function useDynamic<T>(dynamic: Dynamic<T>): T {
	return useSyncExternalStore(
		useCallback(
			(onStoreChange) => {
				const [, dispose] = dynamic.updated.on(() => {
					dynamic.timeline.queueTaskAfterProceed(onStoreChange);
				});
				return dispose;
			},
			[dynamic],
		),
		dynamic.read,
	);
}
