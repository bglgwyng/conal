import {
	AppShell,
	Container,
	Group,
	NavLink,
	Text,
	Title,
} from "@mantine/core";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./App.css";

function App() {
	const location = useLocation();
	const navigate = useNavigate();

	const examples = [
		{ path: "/counter", label: "Counter" },
		{ path: "/computed", label: "Computed" },
		{ path: "/event", label: "Event" },
		{ path: "/switching", label: "Switching" },
		{ path: "/glitch", label: "Glitch" },
		{ path: "/dynamic-network", label: "Dynamic Network" },
		{ path: "/incremental", label: "Incremental" },
		{ path: "/todo", label: "Todo List" }
	];

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
						key={example.path}
						active={location.pathname === example.path}
						label={example.label}
						onClick={() => navigate(example.path)}
						mb="xs"
					/>
				))}
			</AppShell.Navbar>

			<AppShell.Main>
				<Container size="lg">
					<Outlet />
				</Container>
			</AppShell.Main>
		</AppShell>
	);
}

export default App;
