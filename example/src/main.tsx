import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "./index.css";
import { proceedImmediately, Timeline } from "conal";
import App from "./App.tsx";



createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<MantineProvider>
			<App />
		</MantineProvider>
	</StrictMode>,
);
