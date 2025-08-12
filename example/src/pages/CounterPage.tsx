import { Button, Stack, Title } from "@mantine/core";
import type { Dynamic } from "@conaljs/conal";
import { useDynamic } from "../hooks/useDynamic";
import { useRefFactory } from "../hooks/useRefFactory";
import { t } from "../timeline";

export function CounterPage() {
	const [eClick, onClick] = useRefFactory(() => t.source<unknown>());
	const dynamic: Dynamic<number> = useRefFactory(() =>
		t.state<number>(
			0,
			eClick.transform<number>(() => dynamic.read() + 1),
		),
	);

	const count = useDynamic(dynamic);

	return (
		<Stack>
			<Title order={2}>Counter Example</Title>
			<div className="card">
				<Button onClick={onClick}>{count}</Button>
			</div>
		</Stack>
	);
}
