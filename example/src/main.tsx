import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@mantine/core/styles.css";
import "./index.css";
import { proceedImmediately, Timeline } from "conal";
import App from "./App.tsx";
import {
	CounterPage,
} from "./pages";



const router = createBrowserRouter([
	{
		path: "/",
		element: <App />,
		children: [
			{
				index: true,
				element: <Navigate to="/counter" replace />,
			},
			{
				path: "counter",
				element: <CounterPage />,
			},
		],
	},
]);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<MantineProvider>
			<RouterProvider router={router} />
		</MantineProvider>
	</StrictMode>,
);
