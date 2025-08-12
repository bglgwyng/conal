import { Button, Code, Group, Stack, Text, Title } from "@mantine/core";
import type { Dynamic, Event, Incremental } from "conal";
import { Counter } from "../components/Counter";
import { useDynamic } from "../hooks/useDynamic";
import { t } from "../timeline";

const [eAddClick, emitAddClick] = t.source<unknown>();
const [eNewCounter] = eAddClick.on(() => {
	const [eClick, emitClick] = t.source<void>();
	const dCounter: Dynamic<number> = t.state<number>(
		0,
		eClick.transform<number>(() => dCounter.read() + 1),
	);
	return [dCounter, emitClick] as const;
});

const dCounters: Dynamic<[Dynamic<number>, () => void][]> = t.state<
	[Dynamic<number>, () => void][]
>(
	[],
	eNewCounter.transform<[Dynamic<number>, () => void][]>(
		(x) => [...dCounters.read(), x] as [Dynamic<number>, () => void][],
	),
);

const dTotal: Dynamic<number> = t.state(
	0,
	t
		.switching(
			mergeIncremental(
				eNewCounter.transform(([dCounter]) => {
					return dCounter.updated;
				}),
			),
		)
		.transform((xs) => {
			let delta = 0;
			console.info("xs", xs)
			for (const [key, value] of xs) {
				const [dCounter] = dCounters.read()[key];
				delta += value - dCounter.read();
			}
			return delta + dTotal.read();
		}),
);

export function IncrementalPage() {
	const counters = useDynamic(dCounters);
	const total = useDynamic(dTotal);

	return (
		<Stack>
			<Title order={2}>Incremental Example</Title>
			<Stack>
			<Text><Code>Total</Code> is computed incrementally.</Text>
				<Text>Total: {total}</Text>
				<Button onClick={emitAddClick}>Add Counter</Button>
				<Group>
					{counters.map(([dCounter, emitClick], i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<Counter key={i} dynamic={dCounter} onClick={emitClick} />
					))}
				</Group>
			</Stack>
		</Stack>
	);
}

export function mergeIncremental<T>(
	newEvent: Event<Event<T>>,
): Dynamic<Event<[number, T][]>> {
	const t = newEvent.timeline;

	const count: Dynamic<number> = t.state(
		0,
		newEvent.transform(() => count.read() + 1),
	);

	const incremental: Incremental<
		[Event<T>[], Event<[number, T][]>],
		Event<T>
	> = t.incremental<[Event<T>[], Event<[number, T][]>], Event<T>>(
		[[], t.never],
		newEvent.transform((e) => {
			const [events, eKeyed] = incremental.read();

			return [
				[
					events.concat([e]),
					eKeyed.mergeWith(e).transform((x) => {
						if (x.type === "both") {
							return [...x.left, [events.length, x.right]];
						}
						if (x.type === "left") {
							return x.value;
						}
						return [[events.length, x.value]];
					}) as Event<[number, T][]>,
				],
				e,
			] as const;
		}),
	);

	return t.unsafeIncremental(
		() => incremental.read()[1],
		incremental.transition.transform(([[, events], eKeyed]) => {
			return [events, eKeyed];
		}),
	);
}
