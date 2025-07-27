export function fixGenerator<T>(initial: T[], gen: (xs: T[]) => Generator<T>) {
	let xs = initial;
	while (xs.length > 0) {
		const next: T[] = [];
		for (const x of gen(xs)) {
			next.push(x);
		}
		xs = next;
	}
}
