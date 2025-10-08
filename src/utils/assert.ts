export function assert(
	condition: unknown,
	message?: string,
): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

export function assertInternal(
	condition: unknown,
	message?: string,
): asserts condition {
	if (!condition) {
		throw new Error(`Internal error: ${message}. Report this issue.`);
	}
}
