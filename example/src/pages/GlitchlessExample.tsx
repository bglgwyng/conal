import { Anchor, Slider, Stack, Text, Title } from "@mantine/core";
import { useEffect } from "react";
import { DynamicWidthBox } from "../components/DynamicWidthBox";
import { useRefFactory } from "../hooks/useRefFactory";
import { t } from "../timeline";

export function GlitchlessExample() {
	const [eSlider, emitSlider] = useRefFactory(() => t.source<number>());
	const dSlider = useRefFactory(() => t.state<number>(0, eSlider));

	const width1 = useRefFactory(() => t.computed(() => dSlider.read() + 100));
	const width2 = useRefFactory(() =>
		t.computed(() => dSlider.read() * 2 + 100),
	);
	const width3 = useRefFactory(() =>
		t.computed(() => 1000 - (width1.read() + width2.read())),
	);

	useEffect(() => {
		width3.updated
			.mergeWith(width1.updated)
			.mergeWith(width2.updated)
			.on((x) => {
				if (x.type === "both") {
					if (x.left.type === "both") {
						console.info(x.left.left + x.left.right + x.right);
					}
				}
			});
	});

	return (
		<Stack>
			<Title order={2}>Glitchless Example</Title>
			<Text>
				See{" "}
				<Anchor href="https://en.wikipedia.org/wiki/Reactive_programming#Glitches">
					Glitches
				</Anchor>
				.
			</Text>
			<Text>Conal is glitchless.</Text>
			<Stack w={1000}>
				<Slider min={0} max={100} onChange={(value) => emitSlider(value)} />
				<div style={{ display: "flex", flexDirection: "row" }}>
					<DynamicWidthBox dynamic={width1} color="red" text="w1" />
					<DynamicWidthBox dynamic={width2} color="blue" text="w2" />
					<DynamicWidthBox
						dynamic={width3}
						color="green"
						text="1000 - (w1 + w2)"
					/>
				</div>
			</Stack>
		</Stack>
	);
}
