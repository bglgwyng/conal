import {
	AppShell,
	Button,
	Container,
	Group,
	NavLink,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useState } from "react";
import "./App.css";
import { Counter } from "./examples/Counter";

function App() {
	const [activeExample, setActiveExample] = useState("counter");

	const examples = [
		{ id: "counter", label: "Counter Example", },
	];

	const renderContent = () => {
		switch (activeExample) {
			case "counter":
				return (
					<Stack>
						<Title order={2}>Counter Example</Title>
						<div className="card">
							<Counter />
						</div>
					</Stack>
				);
			case "components":
				return (
					<Stack>
						<Title order={2}>Components Example</Title>
						<Text>여기에 컴포넌트 예제들이 들어갑니다.</Text>
					</Stack>
				);
			case "charts":
				return (
					<Stack>
						<Title order={2}>Charts Example</Title>
						<Text>여기에 차트 예제들이 들어갑니다.</Text>
					</Stack>
				);
			case "settings":
				return (
					<Stack>
						<Title order={2}>Settings Example</Title>
						<Text>여기에 설정 예제들이 들어갑니다.</Text>
					</Stack>
				);
			default:
				return (
					<Stack>
						<Title order={1}>Conal Examples</Title>
						<Text size="lg">
							왼쪽 네비게이션에서 다양한 예제들을 확인해보세요.
						</Text>
						<Group>
							<Text>현재 카운터 값: {count}</Text>
							<Button
								variant="light"
								onClick={() => setActiveExample("counter")}
							>
								카운터 예제 보기
							</Button>
						</Group>
					</Stack>
				);
		}
	};

	return (
		<AppShell
			navbar={{
				width: 250,
				breakpoint: "sm",
			}}
			header={{ height: 60 }}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md">
					<Title order={3}>Conal Examples</Title>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<Text size="sm" fw={500} mb="md" c="dimmed">
					Examples
				</Text>
				{examples.map((example) => (
					<NavLink
						key={example.id}
						active={activeExample === example.id}
						label={example.label}
						onClick={() => setActiveExample(example.id)}
						mb="xs"
					/>
				))}
			</AppShell.Navbar>

			<AppShell.Main>
				<Container size="lg">{renderContent()}</Container>
			</AppShell.Main>
		</AppShell>
	);
}

export default App;
