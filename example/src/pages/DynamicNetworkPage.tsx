import { Button, Group, Stack, Title } from "@mantine/core";
import type { Dynamic } from "conal";
import { useDynamic } from "../hooks/useDynamic";
import { t } from "../timeline";

const [eAddClick, emitAddClick] = t.source<unknown>();
const [eNewCounter] = eAddClick.on(() => {
	const [eClick, emitClick] = t.source<void>();
	const dCounter: Dynamic<number> = t.state<number>(
		0,
		eClick.transform<number>(() => dCounter.read() + 1),
	);
	return [dCounter, emitClick] as const;
});

const dCounters: Dynamic<[Dynamic<number>, () => void][]> = t.state<
	[Dynamic<number>, () => void][]
>(
	[],
	eNewCounter.transform<[Dynamic<number>, () => void][]>(
		(x) => [...dCounters.read(), x] as [Dynamic<number>, () => void][],
	),
);


export function DynamicNetworkPage() {
	const counters = useDynamic(dCounters);

	return (
		<Stack>
			<Title order={2}>Switching Example</Title>
			<Stack>
				<Button onClick={emitAddClick}>Add Counter</Button>
				<Group>
					{counters.map(([dCounter, emitClick], i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<Counter key={i} dynamic={dCounter} onClick={emitClick} />
					))}
				</Group>
			</Stack>
		</Stack>
	);
}

function Counter(props: { dynamic: Dynamic<number>; onClick: () => void }) {
	const counter = useDynamic(props.dynamic);
	return <Button onClick={props.onClick}>{counter}</Button>;
}
