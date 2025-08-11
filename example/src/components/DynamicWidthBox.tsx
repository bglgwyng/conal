import type { Dynamic } from "conal";
import { useEffect, useRef } from "react";

export type Props = {
	dynamic: Dynamic<number>;
	text?: string;
	color?: string;
};

export function DynamicWidthBox(props: Props) {
	const { dynamic, color, text } = props;
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const [, dispose] = dynamic.on(() => {
			// Trigger bounce animation
			if (boxRef.current) {
				boxRef.current.style.width = `${dynamic.read()}px`;
			}
		});
		return dispose;
	}, [dynamic]);

	return (
		<div
			ref={boxRef}
			className="box"
			style={{
				height: "50px",
				backgroundColor: color ?? "#007bff",
				margin: "20px auto",
				color: "white",
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{text}
		</div>
	);
}
