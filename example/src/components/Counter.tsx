import { Button } from "@mantine/core";
import type { Dynamic } from "@conaljs/conal";
import { useDynamic } from "../hooks/useDynamic";

export function Counter(props: {
	dynamic: Dynamic<number>;
	onClick: () => void;
}) {
	const counter = useDynamic(props.dynamic);
	return <Button onClick={props.onClick}>{counter}</Button>;
}
