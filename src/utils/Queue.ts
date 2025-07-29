export class Queue<T> {
	private queue: T[] = [];

	push(item: T) {
		this.queue.push(item);
	}

	shift() {
		return this.queue.shift();
	}

	get length() {
		return this.queue.length;
	}
}
