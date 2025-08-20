export class Heap<T> {
	private items: T[] = [];

	constructor(public readonly compare: (a: T, b: T) => number) {}

	/**
	 * Get the number of items in the heap
	 */
	get size(): number {
		return this.items.length;
	}

	/**
	 * Check if the heap is empty
	 */
	isEmpty(): boolean {
		return this.items.length === 0;
	}

	/**
	 * Get the minimum element without removing it
	 */
	peek(): T | undefined {
		return this.items[0];
	}

	/**
	 * Add an element to the heap
	 */
	push(item: T): void {
		this.items.push(item);
		this.heapifyUp(this.items.length - 1);
	}

	/**
	 * Remove and return the minimum element
	 */
	pop(): T | undefined {
		if (this.isEmpty()) {
			return undefined;
		}

		if (this.items.length === 1) {
			return this.items.pop();
		}

		const min = this.items[0];
		// biome-ignore lint/style/noNonNullAssertion: `items.length > 1` ensures this
		this.items[0] = this.items.pop()!;
		this.heapifyDown(0);
		return min;
	}

	/**
	 * Convert array to heap in-place
	 */
	static heapify<T>(array: T[], compare: (a: T, b: T) => number): Heap<T> {
		const heap = new Heap<T>(compare);
		heap.items = [...array];

		// Start from the last non-leaf node and heapify down
		for (let i = Math.floor(heap.items.length / 2) - 1; i >= 0; i--) {
			heap.heapifyDown(i);
		}

		return heap;
	}

	/**
	 * Get all items as an array (not in sorted order)
	 */
	toArray(): T[] {
		return [...this.items];
	}

	/**
	 * Clear all items from the heap
	 */
	clear(): void {
		this.items = [];
	}

	private heapifyUp(index: number): void {
		while (index > 0) {
			const parentIndex = Math.floor((index - 1) / 2);

			if (this.compare(this.items[index], this.items[parentIndex]) >= 0) {
				break;
			}

			this.swap(index, parentIndex);
			index = parentIndex;
		}
	}

	private heapifyDown(index: number): void {
		while (true) {
			let minIndex = index;
			const leftChild = 2 * index + 1;
			const rightChild = 2 * index + 2;

			if (
				leftChild < this.items.length &&
				this.compare(this.items[leftChild], this.items[minIndex]) < 0
			) {
				minIndex = leftChild;
			}

			if (
				rightChild < this.items.length &&
				this.compare(this.items[rightChild], this.items[minIndex]) < 0
			) {
				minIndex = rightChild;
			}

			if (minIndex === index) {
				break;
			}

			this.swap(index, minIndex);
			index = minIndex;
		}
	}

	private swap(i: number, j: number): void {
		[this.items[i], this.items[j]] = [this.items[j], this.items[i]];
	}
}
