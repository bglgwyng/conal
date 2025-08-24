import type { Dynamic } from "@conaljs/conal";
import { useEvent } from "./useEvent";
import { useRefFactory } from "./useRefFactory";
import { useDynamic } from "./useDynamic";
import { t } from "../timeline";

export function useState<T>(
	initialValue: T
): [T, (value: T) => void, Dynamic<T>] {
	const [eUpdate, emitUpdate] = useEvent<T>();
	
	const dynamic = useRefFactory(() => 
		t.state(initialValue, eUpdate)
	);
	
	const value = useDynamic(dynamic);
	
	return [value, emitUpdate, dynamic];
}