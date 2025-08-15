import assert from "assert";

export interface TopoNode {
	rank: number;
	incomings(): Iterable<TopoNode>;
	outcomings(): Iterable<TopoNode>;

	_tag?: string;
}

// Class for managing incremental topological sorting
export class IncrementalTopo {
	nodes = new Set<TopoNode>();

	addNode(node: TopoNode) {
		this.nodes.add(node);
	}
	/**
	 * Adds an edge (u -> v) between two nodes and updates the topological sort.
	 * @param u - Source node
	 * @param v - Target node
	 */
	reorder(u: TopoNode, v: TopoNode) {
		assert(u !== v, "Self-loop not allowed");

		if (u.rank < v.rank) return;

		// Order adjustment needed (u's rank is higher than or equal to v's rank)
		// Find all descendants of v (nodes that follow v).
		const affected = new Set<TopoNode>();
		const queue = [v];
		affected.add(v);

		while (queue.length > 0) {
			const current = queue.shift()!;
			// Cycle detection: if u is found among v's descendants, a cycle would be created
			if (current === u) {
				// Rollback would happen here in a transactional implementation
				throw new Error(`Cycle detected during rank update at ${v._tag}`);
			}
			for (const neighbor of current.outcomings()) {
				if (!affected.has(neighbor)) {
					affected.add(neighbor);
					queue.push(neighbor);
				}
			}
		}

		// Update ranks of affected nodes.
		// v should have at least u.rank + 1, and its descendants should be updated accordingly.
		const sortedAffected = Array.from(affected).sort((a, b) => a.rank - b.rank);

		for (const node of sortedAffected) {
			let maxIncomingRank = -1;
			for (const incoming of node.incomings()) {
				maxIncomingRank = Math.max(maxIncomingRank, incoming.rank);
			}
			node.rank = Math.max(node.rank, maxIncomingRank + 1);
		}
	}

	checkWellOrdered() {
		for (const node of this.nodes) {
			for (const incoming of node.incomings()) {
				if (incoming.rank > node.rank) {
					throw new Error(
						`Node ${incoming._tag}(rank: ${incoming.rank}) and ${node._tag}(rank: ${node.rank}) is not well-ordered`,
					);
				}
			}
			for (const outcoming of node.outcomings()) {
				if (outcoming.rank < node.rank) {
					throw new Error(
						`Node ${outcoming._tag}(rank: ${outcoming.rank}) and ${node._tag}(rank: ${node.rank}) is not well-ordered`,
					);
				}
			}
		}
	}
}
