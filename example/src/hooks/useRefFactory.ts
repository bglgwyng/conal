import { useRef } from "react";

export function useRefFactory<T>(fn: () => T) {
	const ref = useRef<T>(undefined);

	if (!ref.current) {
		ref.current = fn();
	}

	return ref.current;
}
