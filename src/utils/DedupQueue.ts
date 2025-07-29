export class DedupQueue<T> {
	private queue = new Set<T>();

	add(item: T) {
		this.queue.add(item);
	}

	take() {
		const item = this.queue.values().next().value;
		if (item === undefined) return;

		this.queue.delete(item);
		return item;
	}

	has(item: T) {
		return this.queue.has(item);
	}

	get size() {
		return this.queue.size;
	}
}
