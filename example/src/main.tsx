import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@mantine/core/styles.css";
import "./index.css";
import App from "./App.tsx";
import {
	CounterPage,
} from "./pages";
import { ComputedPage } from "./pages/ComputedPage.tsx";



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
			{
				path: "computed",
				element: <ComputedPage />,
			}
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
