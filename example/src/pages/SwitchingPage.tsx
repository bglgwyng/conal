import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { range } from "ramda";
import { useEffect } from "react";
import { BouncingBox } from "../components/BouncingBox";
import { useDynamic } from "../hooks/useDynamic";
import { useRefFactory } from "../hooks/useRefFactory";
import { t } from "../timeline";

export function SwitchingPage() {
	const [eActiveHeartbitIndex, emitActiveHeartbitIndex] = useRefFactory(() =>
		t.source<number>(),
	);
	const dActiveHeartbitIndex = useRefFactory(() =>
		t.state<number>(0, eActiveHeartbitIndex),
	);
	const activeHeartbitIndex = useDynamic(dActiveHeartbitIndex);

	const [eClick, emitClick] = useRefFactory(() => t.source<number>());
	const heartbits = useRefFactory(() => {
		return range(0, 5).map((i) => [200 * (i + 1), t.source<void>()] as const);
	});
	useEffect(() => {
		const timeouts: NodeJS.Timeout[] = [];
		for (const [period, [, emit]] of heartbits) {
			timeouts.push(
				setInterval(() => {
					emit();
				}, period),
			);
		}
		return () => {
			for (const timeout of timeouts) {
				clearTimeout(timeout);
			}
		};
	}, [heartbits]);

	const eActiveHeartbit = useRefFactory(() =>
		t.switching<void>(
			t.computed(() => {
				const [, [eHeartbit]] = heartbits[dActiveHeartbitIndex.read()];
				return eHeartbit;
			}),
		),
	);

	return (
		<Stack>
			<Title order={2}>Switching Example</Title>
			<Stack>
				<Group>
					{heartbits.map(([period, [e]], i) => (
						<div key={period}>
							<BouncingBox
								event={e}
								color={activeHeartbitIndex === i ? "red" : "pink"}
							/>
							<Button onClick={() => emitActiveHeartbitIndex(i)}>
								{period}ms
							</Button>
						</div>
					))}
				</Group>
				<Text>Active Heartbit</Text>
				<BouncingBox event={eActiveHeartbit} color={"red"} />
			</Stack>
		</Stack>
	);
}
