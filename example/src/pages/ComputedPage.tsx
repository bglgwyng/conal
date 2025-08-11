import {
	Input,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useDynamic } from "../hooks/useDynamic";
import { useRefFactory } from "../hooks/useRefFactory";
import { t } from "../timeline";

export function ComputedPage() {
	const [eX, emitX] = useRefFactory(() => t.source<number>());
	const [eY, emitY] = useRefFactory(() => t.source<number>());
	const dX = useRefFactory(() => t.state<number>(1, eX));
	const dY = useRefFactory(() => t.state<number>(1, eY));
	const x = useDynamic(dX);
	const y = useDynamic(dY);
	const z = useDynamic(
		useRefFactory(() => t.computed(() => dX.read() + dY.read())),
	);

	// const count = useDynamic(dynamic);
	return (
		<Stack>
			<Title order={2}>Counter Example</Title>
			<div className="card">
				<Input
					type="number"
					value={x}
					onChange={(e) => emitX(Number(e.target.value))}
				/>
				<Text>+</Text>
				<Input
					type="number"
					value={y}
					onChange={(e) => emitY(Number(e.target.value))}
				/>
				<Text>=</Text><Text>{z}</Text>
			</div>
		</Stack>
	);
}
