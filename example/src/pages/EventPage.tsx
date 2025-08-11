import { Button, Stack, Title } from "@mantine/core";
import { BouncingBox } from "../components/BouncingBox";
import { useRefFactory } from "../hooks/useRefFactory";
import { t } from "../timeline";

export function EventPage() {
	const [eClick, onClick] = useRefFactory(() => t.source<unknown>());

	return (
		<Stack>
			<Title order={2}>Event Example</Title>
			<div className="card">
				<Button onClick={onClick}>Bounce</Button>
				<BouncingBox event={eClick} />
			</div>
		</Stack>
	);
}
