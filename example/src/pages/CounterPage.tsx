import { Stack, Title } from "@mantine/core";
import { Counter } from "../examples/Counter";

export function CounterPage() {
	return (
		<Stack>
			<Title order={2}>Counter Example</Title>
			<div className="card">
				<Counter />
			</div>
		</Stack>
	);
}
