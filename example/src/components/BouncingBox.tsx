import type { Event } from "@conaljs/conal";
import { useEffect, useRef } from "react";

// Add CSS for bounce animation
const bounceStyles = `
  .bounce {
    animation: bounce-animation 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  @keyframes bounce-animation {
    0% { transform: scale(1); }
    30% { transform: scale(1.5); }
    100% { transform: scale(1); }
  }
`;

// Inject styles into document head
if (
	typeof document !== "undefined" &&
	!document.querySelector("#bounce-styles")
) {
	const styleElement = document.createElement("style");
	styleElement.id = "bounce-styles";
	styleElement.textContent = bounceStyles;
	document.head.appendChild(styleElement);
}

export type Props = {
	event: Event<unknown>;
	color?: string;
};

export function BouncingBox(props: Props) {
	const { event, color } = props;
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const [, dispose] = event.on(() => {
			// Trigger bounce animation
			if (boxRef.current) {
				boxRef.current.classList.remove("bounce");
				// Force reflow to restart animation
				boxRef.current.offsetHeight;
				boxRef.current.classList.add("bounce");
			}
		});
		return dispose;
	}, [event]);

	return (
		<div
			ref={boxRef}
			className="box"
			style={{
				width: "50px",
				height: "50px",
				backgroundColor: color ?? "#007bff",
				borderRadius: "4px",
				margin: "20px auto",
			}}
		></div>
	);
}
