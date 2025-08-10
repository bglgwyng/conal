import { Button } from "@mantine/core";
import type { Dynamic } from "conal";
import { useDynamic } from "../hooks/useDynamic";
import { useRefFactory } from "../hooks/useRefFactory";
import { t } from "../timeline";

export function Counter() {
	const [eClick, onClick] = useRefFactory(() => t.source<unknown>());
	const dynamic: Dynamic<number> = useRefFactory(() =>
		t.state<number>(
			0,
			eClick.transform<number>(() => dynamic.read() + 1),
		),
	);

	const count = useDynamic(dynamic);

	return <Button onClick={onClick}>{count}</Button>;
}
